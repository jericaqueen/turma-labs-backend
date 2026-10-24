import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-incentive-payment-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const php = (value: number) => '₱' + value.toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // Human admin calls and trusted database-trigger calls use different credentials.
    const cronSecret = req.headers.get('x-incentive-payment-secret') ?? '';
    if (cronSecret) {
      const { data: tokenRow, error: tokenError } = await supabase
        .from('internal_cron_tokens').select('token').eq('name', 'incentive_payment').maybeSingle();
      if (tokenError || !tokenRow?.token || tokenRow.token !== cronSecret) {
        return reply({ error: 'Unauthorized' }, 401);
      }
    } else {
      const authorization = req.headers.get('Authorization') ?? '';
      if (!authorization.startsWith('Bearer ')) return reply({ error: 'Unauthorized' }, 401);
      const { data: auth, error: authError } = await supabase.auth.getUser(authorization.slice(7));
      if (authError || !auth?.user) return reply({ error: 'Unauthorized' }, 401);
      const { data: admin, error: roleError } = await supabase
        .from('user_roles').select('role')
        .eq('user_id', auth.user.id).eq('role', 'admin').maybeSingle();
      if (roleError || !admin) return reply({ error: 'Admin role required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    // One-time repair of a payout disclosure wrongly posted to a team channel.
    if (body?.cleanup_wrong_general_post === true) {
      const messageId = '1563365516704223254';
      const candidates: [string, string | undefined][] = [
        ['incentives', Deno.env.get('DISCORD_WEBHOOK_INCENTIVES')],
        ['default', Deno.env.get('DISCORD_WEBHOOK_URL')],
      ];
      const attempts: { route: string; status: number }[] = [];
      for (const [routeName, webhook] of candidates) {
        if (!webhook) continue;
        const base = webhook.split('?')[0].replace(/\\/$/, '');
        const res = await fetch(base + '/messages/' + messageId, { method: 'DELETE' });
        attempts.push({ route: routeName, status: res.status });
        if (res.status === 204) return reply({ ok: true, deleted: true, message_id: messageId, route: routeName });
      }
      return reply({ ok: false, deleted: false, attempts }, 404);
    }

    const incentiveId = typeof body?.incentive_id === 'string' ? body.incentive_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(incentiveId)) {
      return reply({ error: 'Valid incentive_id required' }, 400);
    }

    // Never send a payout confirmation for a banked, merely eligible, or unpaid incentive.
    const { data: incentive, error: incentiveError } = await supabase
      .from('weekly_incentives')
      .select('id,user_id,week_ending,amount,status,paid_at')
      .eq('id', incentiveId).maybeSingle();
    if (incentiveError) throw incentiveError;
    if (!incentive) return reply({ error: 'Incentive not found' }, 404);
    if (incentive.status !== 'Paid' || !incentive.paid_at) {
      return reply({ ok: true, sent: false, reason: 'Incentive is not paid' });
    }

    const { data: previous, error: previousError } = await supabase
      .from('incentive_payment_notifications').select('delivery_status,discord_message_id,updated_at')
      .eq('incentive_id', incentive.id).maybeSingle();
    if (previousError) throw previousError;
    if (previous?.delivery_status === 'sent') {
      return reply({ ok: true, sent: false, already_sent: true, message_id: previous.discord_message_id });
    }

    const { data: route, error: routeError } = await supabase
      .from('discord_notification_routes').select('secret_name')
      .eq('user_id', incentive.user_id).maybeSingle();
    if (routeError) throw routeError;
    // Crucial: no default webhook, no shared incentives channel, and no #general fallback.
    const employeeWebhook = route?.secret_name ? Deno.env.get(route.secret_name) : null;
    if (!employeeWebhook) return reply({ error: 'Recipient personal Discord channel is not configured' }, 503);

    // Reserve the per-payment send before contacting Discord. A duplicate call cannot
    // claim the same incentive while another delivery is in progress.
    const now = new Date().toISOString();
    if (!previous) {
      const { error: reserveError } = await supabase.from('incentive_payment_notifications')
        .insert({
          incentive_id: incentive.id,
          recipient_user_id: incentive.user_id,
          delivery_status: 'sending',
          attempt_count: 1,
          updated_at: now,
        });
      if (reserveError?.code === '23505') return reply({ ok: true, sent: false, already_processing: true });
      if (reserveError) throw reserveError;
    } else {
      const stale = Date.now() - new Date(previous.updated_at).getTime() > 5 * 60_000;
      if (previous.delivery_status !== 'failed' && !stale) {
        return reply({ ok: true, sent: false, already_processing: true });
      }
      const { data: reserved, error: reserveError } = await supabase
        .from('incentive_payment_notifications')
        .update({ delivery_status: 'sending', attempt_count: 2, last_error: null, updated_at: now })
        .eq('incentive_id', incentive.id)
        .eq('delivery_status', previous.delivery_status)
        .eq('updated_at', previous.updated_at)
        .select('incentive_id');
      if (reserveError) throw reserveError;
      if (!reserved?.length) return reply({ ok: true, sent: false, already_processing: true });
    }

    const { data: profile } = await supabase
      .from('profiles').select('name').eq('user_id', incentive.user_id).maybeSingle();

    const discordPayload = {
      username: 'Turma Labs',
      embeds: [{
        title: '💸 Your incentive payment is confirmed',
        color: 0x22c55e,
        description: `Hi ${profile?.name?.split(' ')[0] ?? 'there'}, your incentive has been paid. Thank you for your great work!`,
        fields: [
          { name: 'Amount paid', value: php(Number(incentive.amount)), inline: true },
          { name: 'Week ending', value: String(incentive.week_ending), inline: true },
        ],
        footer: { text: 'Private payment confirmation from Team Turma' },
        timestamp: new Date().toISOString(),
      }],
    };

    let response: Response;
    try {
      const waitUrl = employeeWebhook + (employeeWebhook.includes('?') ? '&' : '?') + 'wait=true';
      response = await fetch(waitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });
    } catch (e) {
      await supabase.from('incentive_payment_notifications')
        .update({ delivery_status: 'failed', last_error: 'Webhook connection failed', updated_at: new Date().toISOString() })
        .eq('incentive_id', incentive.id);
      return reply({ ok: false, sent: false, error: 'Personal Discord delivery failed' }, 502);
    }

    let discordResponse: { id?: string; channel_id?: string } = {};
    try { discordResponse = await response.json(); } catch { /* non-JSON is not confirmed delivery */ }
    if (!response.ok || !discordResponse.id) {
      await supabase.from('incentive_payment_notifications')
        .update({
          delivery_status: 'failed',
          last_error: `Discord HTTP ${response.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq('incentive_id', incentive.id);
      return reply({ ok: false, sent: false, error: 'Personal Discord delivery was not confirmed', http_status: response.status }, 502);
    }

    const { error: saveError } = await supabase.from('incentive_payment_notifications')
      .update({
        delivery_status: 'sent',
        delivered_at: new Date().toISOString(),
        discord_message_id: discordResponse.id,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('incentive_id', incentive.id);
    if (saveError) {
      console.error('Personal Discord payment delivered but database receipt save failed', saveError);
      return reply({ ok: false, delivered: true, tracking_saved: false, message_id: discordResponse.id }, 500);
    }
    return reply({ ok: true, sent: true, recipient_user_id: incentive.user_id,
      message_id: discordResponse.id, target: 'recipient_personal_channel_only' });
  } catch (error) {
    console.error('notify-incentive-paid error', error);
    return reply({ error: 'Unexpected incentive payment notification error' }, 500);
  }
});
