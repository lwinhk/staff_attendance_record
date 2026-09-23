export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: "0001_tenant_auth_foundation",
    sql: `
      create table tenants (
        id uuid primary key,
        slug varchar(80) not null,
        status varchar(20) not null default 'active' check (status in ('active', 'suspended')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        unique (slug)
      );

      create table tenant_settings (
        tenant_id uuid primary key references tenants(id),
        company_name varchar(200) not null,
        logo_object_key text,
        timezone varchar(80) not null default 'Pacific/Auckland',
        primary_color varchar(7) not null default '#173f35',
        default_daily_minutes integer not null default 480 check (default_daily_minutes between 1 and 1440),
        default_language varchar(2) not null default 'en' check (default_language in ('en', 'my')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table users (
        id uuid primary key,
        tenant_id uuid references tenants(id),
        role varchar(30) not null check (role in ('super_admin', 'tenant_admin', 'operations_admin', 'site_supervisor')),
        display_name varchar(160) not null,
        email varchar(320),
        phone varchar(32),
        password_hash text not null,
        status varchar(20) not null default 'active' check (status in ('active', 'disabled')),
        preferred_language varchar(2) not null default 'en' check (preferred_language in ('en', 'my')),
        password_changed_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        check (email is not null or phone is not null),
        check ((role = 'super_admin' and tenant_id is null) or (role <> 'super_admin' and tenant_id is not null))
      );

      create unique index users_email_unique on users (lower(email)) where email is not null and deleted_at is null;
      create unique index users_phone_unique on users (phone) where phone is not null and deleted_at is null;
      create unique index one_tenant_admin_per_tenant on users (tenant_id) where role = 'tenant_admin' and deleted_at is null;
      create index users_tenant_idx on users (tenant_id) where deleted_at is null;

      create table sessions (
        token_hash char(64) primary key,
        user_id uuid not null references users(id) on delete cascade,
        expires_at timestamptz not null,
        last_seen_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );
      create index sessions_user_idx on sessions (user_id);
      create index sessions_expiry_idx on sessions (expires_at);

      create table audit_events (
        id uuid primary key,
        tenant_id uuid references tenants(id),
        actor_user_id uuid references users(id),
        action varchar(100) not null,
        entity_type varchar(80) not null,
        entity_id uuid,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create index audit_events_tenant_created_idx on audit_events (tenant_id, created_at desc);
      create index audit_events_actor_idx on audit_events (actor_user_id, created_at desc);
    `,
  },
  {
    id: "0002_employee_site_foundation",
    sql: `
      create table employee_roles (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        name varchar(120) not null,
        normal_daily_minutes integer not null check (normal_daily_minutes between 1 and 1440),
        status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create unique index employee_roles_tenant_name_unique on employee_roles (tenant_id, lower(name)) where deleted_at is null;

      create table employees (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        employee_code varchar(80) not null,
        full_name varchar(200) not null,
        photo_object_key text,
        employee_role_id uuid not null references employee_roles(id),
        employment_status varchar(20) not null default 'active' check (employment_status in ('active', 'inactive')),
        contact_phone varchar(32),
        contact_email varchar(320),
        emergency_contact_name varchar(160),
        emergency_contact_phone varchar(32),
        emergency_contact_relation varchar(80),
        normal_daily_minutes_override integer check (normal_daily_minutes_override between 1 and 1440),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create unique index employees_tenant_code_unique on employees (tenant_id, lower(employee_code)) where deleted_at is null;
      create index employees_tenant_status_idx on employees (tenant_id, employment_status) where deleted_at is null;
      create index employees_role_idx on employees (employee_role_id) where deleted_at is null;

      create table employee_documents (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        employee_id uuid not null references employees(id),
        document_type varchar(30) not null check (document_type in ('national_id', 'drivers_license')),
        object_key text not null,
        original_filename varchar(255) not null,
        mime_type varchar(120) not null,
        size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
        verification_status varchar(30) not null default 'pending_verification' check (verification_status in ('pending_verification', 'verified', 'rejected')),
        rejection_reason text,
        verified_by uuid references users(id),
        verified_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create index employee_documents_employee_idx on employee_documents (tenant_id, employee_id) where deleted_at is null;

      create table sites (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        site_code varchar(80) not null,
        site_name varchar(200) not null,
        client_name varchar(200),
        address text not null,
        contact_person varchar(200),
        contact_phone varchar(32),
        status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
        notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create unique index sites_tenant_code_unique on sites (tenant_id, lower(site_code)) where deleted_at is null;
      create index sites_tenant_status_idx on sites (tenant_id, status) where deleted_at is null;

      create table supervisor_site_assignments (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        supervisor_user_id uuid not null references users(id),
        site_id uuid not null references sites(id),
        effective_from date not null,
        effective_to date,
        created_by uuid not null references users(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        check (effective_to is null or effective_to >= effective_from)
      );
      create index supervisor_assignments_site_dates_idx on supervisor_site_assignments (tenant_id, site_id, effective_from, effective_to) where deleted_at is null;
      create index supervisor_assignments_user_dates_idx on supervisor_site_assignments (tenant_id, supervisor_user_id, effective_from, effective_to) where deleted_at is null;
    `,
  },
  {
    id: "0003_employee_role_tenant_default",
    sql: `
      alter table employee_roles alter column normal_daily_minutes drop not null;
    `,
  },
  {
    id: "0004_duty_roster_notifications",
    sql: `
      create table employee_site_assignments (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        employee_id uuid not null references employees(id),
        site_id uuid not null references sites(id),
        effective_from date not null,
        effective_to date,
        assigned_weekdays smallint[] not null,
        conflict_acknowledged boolean not null default false,
        conflict_acknowledged_by uuid references users(id),
        created_by uuid not null references users(id),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        check (effective_to is null or effective_to >= effective_from),
        check (cardinality(assigned_weekdays) > 0),
        check (assigned_weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
      );
      create index employee_site_assignments_employee_dates_idx on employee_site_assignments (tenant_id, employee_id, effective_from, effective_to) where deleted_at is null;
      create index employee_site_assignments_site_dates_idx on employee_site_assignments (tenant_id, site_id, effective_from, effective_to) where deleted_at is null;
      create index employee_site_assignments_weekdays_idx on employee_site_assignments using gin (assigned_weekdays) where deleted_at is null;

      create table notifications (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        user_id uuid not null references users(id),
        notification_type varchar(80) not null,
        title_key varchar(120) not null,
        payload jsonb not null default '{}'::jsonb,
        read_at timestamptz,
        created_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create index notifications_user_created_idx on notifications (tenant_id, user_id, created_at desc) where deleted_at is null;
      create index notifications_unread_idx on notifications (tenant_id, user_id, created_at desc) where read_at is null and deleted_at is null;
    `,
  },
  {
    id: "0005_attendance_collection",
    sql: `
      create table attendance_records (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        employee_id uuid not null references employees(id),
        site_id uuid not null references sites(id),
        attendance_date date not null,
        submitted_status varchar(20) not null check (submitted_status in ('present', 'absent')),
        started_at timestamptz,
        ended_at timestamptz,
        is_late boolean not null default false,
        is_early_end boolean not null default false,
        remark text,
        submitted_by uuid not null references users(id),
        client_operation_id uuid not null,
        version integer not null default 1 check (version > 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz,
        check (
          (submitted_status = 'absent' and started_at is null and ended_at is null and is_late = false and is_early_end = false)
          or
          (submitted_status = 'present' and started_at is not null and (ended_at is null or ended_at > started_at))
        )
      );
      create unique index attendance_employee_site_date_unique on attendance_records (tenant_id, employee_id, site_id, attendance_date) where deleted_at is null;
      create unique index attendance_client_operation_unique on attendance_records (tenant_id, client_operation_id);
      create index attendance_tenant_date_site_idx on attendance_records (tenant_id, attendance_date, site_id) where deleted_at is null;
      create index attendance_employee_date_idx on attendance_records (tenant_id, employee_id, attendance_date) where deleted_at is null;

      create table attendance_revisions (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        attendance_id uuid not null references attendance_records(id),
        revision_number integer not null,
        previous_values jsonb not null,
        new_values jsonb not null,
        reason text not null,
        edited_by uuid not null references users(id),
        editor_role varchar(30) not null,
        created_at timestamptz not null default now(),
        unique (attendance_id, revision_number)
      );
      create index attendance_revisions_tenant_attendance_idx on attendance_revisions (tenant_id, attendance_id, revision_number desc);
    `,
  },
  {
    id: "0006_report_export_jobs",
    sql: `
      create table report_export_jobs (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        requested_by uuid not null references users(id),
        report_type varchar(40) not null check (report_type in ('attendance_detail','employee_site_summary','employee_summary')),
        file_format varchar(10) not null check (file_format in ('csv','xlsx')),
        filters jsonb not null,
        status varchar(20) not null default 'queued' check (status in ('queued','processing','completed','failed')),
        object_key text,
        row_count integer,
        error_message text,
        created_at timestamptz not null default now(),
        started_at timestamptz,
        completed_at timestamptz,
        expires_at timestamptz,
        deleted_at timestamptz
      );
      create index report_export_jobs_queue_idx on report_export_jobs (status, created_at) where deleted_at is null;
      create index report_export_jobs_tenant_user_idx on report_export_jobs (tenant_id, requested_by, created_at desc) where deleted_at is null;
    `,
  },
  {
    id: "0007_ai_recommendation_foundation",
    sql: `
      create table ai_recommendations (
        id uuid primary key,
        tenant_id uuid not null references tenants(id),
        recommendation_type varchar(80) not null,
        provider varchar(80) not null,
        model varchar(120),
        input_summary jsonb not null default '{}'::jsonb,
        recommendation jsonb not null,
        rationale text,
        status varchar(20) not null default 'pending' check (status in ('pending','approved','rejected')),
        decided_by uuid references users(id),
        decision_reason text,
        decided_at timestamptz,
        created_at timestamptz not null default now(),
        deleted_at timestamptz
      );
      create index ai_recommendations_tenant_status_idx on ai_recommendations (tenant_id,status,created_at desc) where deleted_at is null;
    `,
  },
];
