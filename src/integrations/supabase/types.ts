export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      balance_accounts: {
        Row: {
          created_at: string
          id: string
          label: string
          monthly_salary: number
          netflix_amount: number
          rent_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          monthly_salary?: number
          netflix_amount?: number
          rent_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          monthly_salary?: number
          netflix_amount?: number
          rent_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      balance_monthly_charges: {
        Row: {
          account_id: string
          created_at: string
          id: string
          netflix_amount: number
          period: string
          rent_amount: number
          settled_at: string | null
          settled_by: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          netflix_amount?: number
          period: string
          rent_amount?: number
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          netflix_amount?: number
          period?: string
          rent_amount?: number
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_monthly_charges_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "balance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_monthly_charges_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "balance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_source_files: {
        Row: {
          account_id: string
          created_at: string
          file_name: string | null
          file_path: string | null
          id: string
          label: string
          slot: number
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          label: string
          slot: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          label?: string
          slot?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_source_files_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "balance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date_precision: string
          date_unknown: boolean
          description: string | null
          direction: string
          excluded_from_balance: boolean
          id: string
          occurred_on: string | null
          ordinal: number
          proof_name: string | null
          proof_path: string | null
          schedule_key: string | null
          seed_key: string | null
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          date_precision?: string
          date_unknown?: boolean
          description?: string | null
          direction: string
          excluded_from_balance?: boolean
          id?: string
          occurred_on?: string | null
          ordinal?: number
          proof_name?: string | null
          proof_path?: string | null
          schedule_key?: string | null
          seed_key?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date_precision?: string
          date_unknown?: boolean
          description?: string | null
          direction?: string
          excluded_from_balance?: boolean
          id?: string
          occurred_on?: string | null
          ordinal?: number
          proof_name?: string | null
          proof_path?: string | null
          schedule_key?: string | null
          seed_key?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "balance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "balance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      breaks: {
        Row: {
          break_end: string | null
          break_start: string
          break_type: string
          created_at: string
          date: string
          duration_minutes: number | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string
          break_type?: string
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          break_end?: string | null
          break_start?: string
          break_type?: string
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coe_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          purpose: string
          status: string
          superseded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          purpose: string
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          purpose?: string
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discord_notification_routes: {
        Row: {
          created_at: string | null
          id: string
          secret_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          secret_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          secret_name?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_payroll_settings: {
        Row: {
          bank_account_number: string | null
          bank_name: string | null
          base_salary_override: number | null
          created_at: string
          created_by: string
          deductions: number | null
          effective_from: string | null
          hourly_overtime_rate: number | null
          id: string
          is_active: boolean | null
          overtime_rate_multiplier: number | null
          paid_leave_days: number | null
          pay_frequency: string
          payout_day_1: number
          payout_day_2: number | null
          payout_timezone: string
          tax_number: string | null
          updated_at: string
          user_id: string
          working_days_per_month: number | null
        }
        Insert: {
          bank_account_number?: string | null
          bank_name?: string | null
          base_salary_override?: number | null
          created_at?: string
          created_by: string
          deductions?: number | null
          effective_from?: string | null
          hourly_overtime_rate?: number | null
          id?: string
          is_active?: boolean | null
          overtime_rate_multiplier?: number | null
          paid_leave_days?: number | null
          pay_frequency?: string
          payout_day_1?: number
          payout_day_2?: number | null
          payout_timezone?: string
          tax_number?: string | null
          updated_at?: string
          user_id: string
          working_days_per_month?: number | null
        }
        Update: {
          bank_account_number?: string | null
          bank_name?: string | null
          base_salary_override?: number | null
          created_at?: string
          created_by?: string
          deductions?: number | null
          effective_from?: string | null
          hourly_overtime_rate?: number | null
          id?: string
          is_active?: boolean | null
          overtime_rate_multiplier?: number | null
          paid_leave_days?: number | null
          pay_frequency?: string
          payout_day_1?: number
          payout_day_2?: number | null
          payout_timezone?: string
          tax_number?: string | null
          updated_at?: string
          user_id?: string
          working_days_per_month?: number | null
        }
        Relationships: []
      }
      employee_salaries: {
        Row: {
          base_monthly_salary: number
          created_at: string
          created_by: string
          effective_from: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          base_monthly_salary: number
          created_at?: string
          created_by: string
          effective_from?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          base_monthly_salary?: number
          created_at?: string
          created_by?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_schedule: {
        Row: {
          break_minutes: number
          created_at: string
          day_of_week: number
          employee_id: string
          end_local: string
          grace_in_minutes: number
          grace_out_minutes: number
          id: string
          is_workday: boolean
          required_minutes_per_day: number
          start_local: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          day_of_week: number
          employee_id: string
          end_local?: string
          grace_in_minutes?: number
          grace_out_minutes?: number
          id?: string
          is_workday?: boolean
          required_minutes_per_day?: number
          start_local?: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          day_of_week?: number
          employee_id?: string
          end_local?: string
          grace_in_minutes?: number
          grace_out_minutes?: number
          id?: string
          is_workday?: boolean
          required_minutes_per_day?: number
          start_local?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_cron_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          reason: string
          start_date: string
          status: string
          superseded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: string
          notes?: string | null
          reason: string
          start_date: string
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          reason?: string
          start_date?: string
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          hours_requested: number
          id: string
          notes: string | null
          reason: string | null
          request_date: string
          request_type: string
          status: string
          superseded_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          hours_requested?: number
          id?: string
          notes?: string | null
          reason?: string | null
          request_date: string
          request_type: string
          status?: string
          superseded_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          hours_requested?: number
          id?: string
          notes?: string | null
          reason?: string | null
          request_date?: string
          request_type?: string
          status?: string
          superseded_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          adjustment_notes: string | null
          base_salary: number
          capped_regular_hours: number | null
          created_at: string
          daily_rate: number | null
          excess_days: number | null
          excess_days_pay: number | null
          final_pay: number | null
          generated_at: string
          generated_by: string
          hourly_rate: number
          id: string
          lop_days: number | null
          manual_adjustments: number | null
          month_year: string
          overtime_hours: number
          overtime_pay: number
          paid_leave_days: number
          payslip_generated: boolean
          regular_hours: number | null
          salary_loan_deduction: number | null
          salary_loan_remaining_payments: number | null
          tardy_deduction: number | null
          tardy_minutes: number | null
          total_computed_pay: number
          total_deductions: number | null
          unpaid_extra_hours: number | null
          updated_at: string
          user_id: string
          worked_days: number | null
          working_days_in_month: number
        }
        Insert: {
          adjustment_notes?: string | null
          base_salary: number
          capped_regular_hours?: number | null
          created_at?: string
          daily_rate?: number | null
          excess_days?: number | null
          excess_days_pay?: number | null
          final_pay?: number | null
          generated_at?: string
          generated_by: string
          hourly_rate: number
          id?: string
          lop_days?: number | null
          manual_adjustments?: number | null
          month_year: string
          overtime_hours?: number
          overtime_pay?: number
          paid_leave_days?: number
          payslip_generated?: boolean
          regular_hours?: number | null
          salary_loan_deduction?: number | null
          salary_loan_remaining_payments?: number | null
          tardy_deduction?: number | null
          tardy_minutes?: number | null
          total_computed_pay: number
          total_deductions?: number | null
          unpaid_extra_hours?: number | null
          updated_at?: string
          user_id: string
          worked_days?: number | null
          working_days_in_month: number
        }
        Update: {
          adjustment_notes?: string | null
          base_salary?: number
          capped_regular_hours?: number | null
          created_at?: string
          daily_rate?: number | null
          excess_days?: number | null
          excess_days_pay?: number | null
          final_pay?: number | null
          generated_at?: string
          generated_by?: string
          hourly_rate?: number
          id?: string
          lop_days?: number | null
          manual_adjustments?: number | null
          month_year?: string
          overtime_hours?: number
          overtime_pay?: number
          paid_leave_days?: number
          payslip_generated?: boolean
          regular_hours?: number | null
          salary_loan_deduction?: number | null
          salary_loan_remaining_payments?: number | null
          tardy_deduction?: number | null
          tardy_minutes?: number | null
          total_computed_pay?: number
          total_deductions?: number | null
          unpaid_extra_hours?: number | null
          updated_at?: string
          user_id?: string
          worked_days?: number | null
          working_days_in_month?: number
        }
        Relationships: []
      }
      payroll_settings: {
        Row: {
          created_at: string
          default_grace_in_minutes: number | null
          default_grace_out_minutes: number | null
          default_required_minutes_per_day: number | null
          id: string
          standard_work_hours_per_day: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_grace_in_minutes?: number | null
          default_grace_out_minutes?: number | null
          default_required_minutes_per_day?: number | null
          id?: string
          standard_work_hours_per_day?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_grace_in_minutes?: number | null
          default_grace_out_minutes?: number | null
          default_required_minutes_per_day?: number | null
          id?: string
          standard_work_hours_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      payslip_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          month: number
          status: string
          superseded_at: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          month: number
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          month?: number
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client: string | null
          created_at: string
          email: string
          employee_number: string | null
          gender: string | null
          id: string
          incentive_test_mode: boolean
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          email: string
          employee_number?: string | null
          gender?: string | null
          id?: string
          incentive_test_mode?: boolean
          name: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client?: string | null
          created_at?: string
          email?: string
          employee_number?: string | null
          gender?: string | null
          id?: string
          incentive_test_mode?: boolean
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_loan_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          monthly_deduction: number | null
          notes: string | null
          reason: string
          remaining_payments: number | null
          repayment_months: number
          status: string
          superseded_at: string | null
          total_payments: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          monthly_deduction?: number | null
          notes?: string | null
          reason: string
          remaining_payments?: number | null
          repayment_months: number
          status?: string
          superseded_at?: string | null
          total_payments?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          monthly_deduction?: number | null
          notes?: string | null
          reason?: string
          remaining_payments?: number | null
          repayment_months?: number
          status?: string
          superseded_at?: string | null
          total_payments?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sop_documents: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      time_adjustment_requests: {
        Row: {
          adjustment_date: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string
          original_time_in: string | null
          original_time_out: string | null
          reason: string
          requested_time_in: string | null
          requested_time_out: string | null
          status: string
          superseded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_date: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason: string
          requested_time_in?: string | null
          requested_time_out?: string | null
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_date?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string
          original_time_in?: string | null
          original_time_out?: string | null
          reason?: string
          requested_time_in?: string | null
          requested_time_out?: string | null
          status?: string
          superseded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_logs: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          date: string
          id: string
          is_paid_leave: boolean | null
          notes: string | null
          overtime_hours: number | null
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          is_paid_leave?: boolean | null
          notes?: string | null
          overtime_hours?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          is_paid_leave?: boolean | null
          notes?: string | null
          overtime_hours?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_materials: {
        Row: {
          article_link: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          tags: string[] | null
          title: string
          updated_at: string
          video_link: string | null
        }
        Insert: {
          article_link?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          video_link?: string | null
        }
        Update: {
          article_link?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          video_link?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_content_guides: {
        Row: {
          content: string | null
          created_at: string
          discord_status: string | null
          id: string
          sent_at: string | null
          sources: Json
          updated_at: string
          week_start: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          discord_status?: string | null
          id?: string
          sent_at?: string | null
          sources?: Json
          updated_at?: string
          week_start: string
        }
        Update: {
          content?: string | null
          created_at?: string
          discord_status?: string | null
          id?: string
          sent_at?: string | null
          sources?: Json
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_incentive_acks: {
        Row: {
          acknowledged_at: string
          id: string
          user_id: string
          week_ending: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          user_id: string
          week_ending: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          user_id?: string
          week_ending?: string
        }
        Relationships: []
      }
      weekly_incentives: {
        Row: {
          amount: number
          created_at: string
          decision: string
          final_score: number | null
          gcash_name: string | null
          gcash_number: string | null
          id: string
          paid_at: string | null
          paid_by: string | null
          requested_at: string | null
          status: string
          updated_at: string
          user_id: string
          week_ending: string
          week_start: string
          weekly_completion: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          decision: string
          final_score?: number | null
          gcash_name?: string | null
          gcash_number?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          requested_at?: string | null
          status: string
          updated_at?: string
          user_id: string
          week_ending: string
          week_start: string
          weekly_completion?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          decision?: string
          final_score?: number | null
          gcash_name?: string | null
          gcash_number?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          requested_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          week_ending?: string
          week_start?: string
          weekly_completion?: number | null
        }
        Relationships: []
      }
      weekly_performance_recognitions: {
        Row: {
          announced_at: string | null
          created_at: string
          discord_status: string | null
          finalized: boolean
          id: string
          results: Json
          source: string
          top_performers: Json
          top_score: number | null
          updated_at: string
          week_ending: string
          week_start: string
          whatsapp_status: string | null
        }
        Insert: {
          announced_at?: string | null
          created_at?: string
          discord_status?: string | null
          finalized?: boolean
          id?: string
          results?: Json
          source?: string
          top_performers?: Json
          top_score?: number | null
          updated_at?: string
          week_ending: string
          week_start: string
          whatsapp_status?: string | null
        }
        Update: {
          announced_at?: string | null
          created_at?: string
          discord_status?: string | null
          finalized?: boolean
          id?: string
          results?: Json
          source?: string
          top_performers?: Json
          top_score?: number | null
          updated_at?: string
          week_ending?: string
          week_start?: string
          whatsapp_status?: string | null
        }
        Relationships: []
      }
      weekly_recognition_settings: {
        Row: {
          created_at: string
          discord_enabled: boolean
          id: string
          singleton: boolean
          updated_at: string
          whatsapp_destination: string | null
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          discord_enabled?: boolean
          id?: string
          singleton?: boolean
          updated_at?: string
          whatsapp_destination?: string | null
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          discord_enabled?: boolean
          id?: string
          singleton?: boolean
          updated_at?: string
          whatsapp_destination?: string | null
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_close_previous_day_logs: { Args: never; Returns: undefined }
      bank_weekly_incentive: {
        Args: {
          p_amount: number
          p_final_score: number | null
          p_week_ending: string
          p_week_start: string
          p_weekly_completion: number | null
        }
        Returns: string
      }
      backfill_approved_leaves: {
        Args: { days_back?: number }
        Returns: undefined
      }
      claim_weekly_incentive: {
        Args: {
          p_amount: number
          p_final_score: number | null
          p_gcash_name: string
          p_gcash_number: string
          p_week_ending: string
          p_week_start: string
          p_weekly_completion: number | null
        }
        Returns: string
      }
      calculate_daily_hours_with_caps:
        | {
            Args: { p_employee_id: string; p_work_date: string }
            Returns: {
              actual_end_utc: string
              actual_start_utc: string
              approved_ot_minutes: number
              employee_id: string
              paid_ot_minutes: number
              regular_minutes_capped: number
              scheduled_end_utc: string
              scheduled_start_utc: string
              tardy_deduction: number
              tardy_minutes: number
              unpaid_extra_minutes: number
              work_date: string
              worked_minutes_raw: number
            }[]
          }
        | {
            Args: { p_employee_id: string; p_work_date: string }
            Returns: {
              actual_end_utc: string
              actual_start_utc: string
              approved_ot_minutes: number
              employee_id: string
              paid_ot_minutes: number
              regular_minutes_capped: number
              scheduled_end_utc: string
              scheduled_start_utc: string
              tardy_deduction: number
              tardy_minutes: number
              unpaid_extra_minutes: number
              work_date: string
              worked_minutes_raw: number
            }[]
          }
      calculate_daily_rate: { Args: { base_salary: number }; Returns: number }
      calculate_monthly_payroll_with_caps: {
        Args: { p_month: number; p_year: number }
        Returns: {
          approved_ot_hours: number
          base_salary: number
          employee_id: string
          employee_name: string
          excess_days_pay: number
          gross_pay: number
          net_pay_before_other_deductions: number
          overtime_pay: number
          regular_hours: number
          regular_pay: number
          total_tardy_deduction: number
          total_tardy_minutes: number
          unpaid_extra_hours: number
          worked_days: number
        }[]
      }
      calculate_ot_rate: { Args: { base_salary: number }; Returns: number }
      can_access_balance_account: {
        Args: { _account_id: string }
        Returns: boolean
      }
      fix_duplicate_time_logs: { Args: never; Returns: undefined }
      generate_attendance_range: {
        Args: { end_date: string; start_date: string }
        Returns: undefined
      }
      generate_attendance_records: {
        Args: { target_date?: string }
        Returns: undefined
      }
      get_overtime_hours: {
        Args: { p_date: string; p_user_id: string }
        Returns: number
      }
      get_worked_days_in_month: {
        Args: { p_user_id: string; target_month: number; target_year: number }
        Returns: number
      }
      get_working_days_in_month: {
        Args: { target_month: number; target_year: number }
        Returns: number
      }
      handle_leave_approval: {
        Args: { approved_by_user_id: string; p_leave_id: string }
        Returns: undefined
      }
      handle_overtime_approval: {
        Args: { approved_by_user_id: string; overtime_id: string }
        Returns: undefined
      }
      handle_time_adjustment_approval: {
        Args: { adjustment_id: string; approved_by_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      integrate_approved_leaves_to_payroll: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "va"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "va"],
    },
  },
} as const