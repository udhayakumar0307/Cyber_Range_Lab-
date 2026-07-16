--
-- PostgreSQL database dump
--

-- \restrict aBKBEHovuLjQ7xhNGPpYzvp2TNZrt3dDTlDgaofa0TcQc9paXorhKrrqIbwuqJL

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


-- ALTER TABLE public.alembic_version OWNER TO cyberrange_migrate;

--
-- Name: c2_subnet_pool; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.c2_subnet_pool (
    octet integer NOT NULL,
    subnet_cidr text NOT NULL,
    status text DEFAULT 'free'::text NOT NULL,
    deployment_id uuid,
    allocated_at timestamp with time zone,
    freed_at timestamp with time zone,
    CONSTRAINT c2_subnet_pool_status_check CHECK ((status = ANY (ARRAY['free'::text, 'in_use'::text])))
);


-- ALTER TABLE public.c2_subnet_pool OWNER TO cyberrange_migrate;

--
-- Name: challenges; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_id uuid NOT NULL,
    title text NOT NULL,
    category text,
    difficulty text,
    points integer DEFAULT 0 NOT NULL,
    flag_hash text NOT NULL,
    scenario text,
    instructions text,
    hints jsonb,
    solution_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    challenge_url text
);


-- ALTER TABLE public.challenges OWNER TO cyberrange_migrate;

--
-- Name: cohort_runs; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.cohort_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workshop_id uuid NOT NULL,
    content_id uuid NOT NULL,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.cohort_runs OWNER TO cyberrange_migrate;

--
-- Name: content_items; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.content_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    difficulty text,
    duration_minutes integer,
    is_active boolean DEFAULT true,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT content_items_type_check CHECK ((type = ANY (ARRAY['lab'::text, 'quiz'::text])))
);


-- ALTER TABLE public.content_items OWNER TO cyberrange_migrate;

--
-- Name: content_page_revisions; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.content_page_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid NOT NULL,
    content text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.content_page_revisions OWNER TO cyberrange_migrate;

--
-- Name: content_pages; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.content_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.content_pages OWNER TO cyberrange_migrate;

--
-- Name: content_prices; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.content_prices (
    content_id uuid NOT NULL,
    amount_minor integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.content_prices OWNER TO cyberrange_migrate;

--
-- Name: content_sections; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.content_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid NOT NULL,
    title text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    config jsonb
);


-- ALTER TABLE public.content_sections OWNER TO cyberrange_migrate;

--
-- Name: course_admin_assignments; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.course_admin_assignments (
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.course_admin_assignments OWNER TO cyberrange_migrate;

--
-- Name: course_guardrails; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.course_guardrails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_admin_id uuid NOT NULL,
    content_id uuid NOT NULL,
    max_concurrent_deployments integer DEFAULT 10 NOT NULL,
    max_duration_hours integer DEFAULT 4 NOT NULL,
    set_by uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.course_guardrails OWNER TO cyberrange_migrate;

--
-- Name: course_participants; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.course_participants (
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    enrolled_by uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.course_participants OWNER TO cyberrange_migrate;

--
-- Name: deployment_members; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.deployment_members (
    deployment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.deployment_members OWNER TO cyberrange_migrate;

--
-- Name: entitlements; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT entitlements_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text])))
);


-- ALTER TABLE public.entitlements OWNER TO cyberrange_migrate;

--
-- Name: headscale_identities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.headscale_identities (
    user_id uuid NOT NULL,
    headscale_username text NOT NULL,
    headscale_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.headscale_identities OWNER TO postgres;

--
-- Name: headscale_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.headscale_keys (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    key_hash text NOT NULL,
    hs_id text,
    hs_user text,
    reusable boolean DEFAULT false,
    ephemeral boolean DEFAULT false,
    used boolean DEFAULT false,
    expiration timestamp with time zone,
    hs_created_at timestamp with time zone,
    acl_tags text[],
    created_at timestamp with time zone DEFAULT now()
);


-- ALTER TABLE public.headscale_keys OWNER TO postgres;

--
-- Name: headscale_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.headscale_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.headscale_keys_id_seq OWNER TO postgres;

--
-- Name: headscale_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.headscale_keys_id_seq OWNED BY public.headscale_keys.id;


--
-- Name: lab_deployments; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.lab_deployments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    lab_type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    terraform_workspace text NOT NULL,
    instance_public_ip text,
    instance_private_ip text,
    terraform_outputs jsonb,
    error_message text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_subnet_cidr text,
    CONSTRAINT lab_deployments_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'provisioning'::text, 'running'::text, 'failed'::text, 'terminating'::text, 'cleanup_failed'::text, 'expired'::text]))),
    CONSTRAINT lab_status_transition CHECK ((status = ANY (ARRAY['queued'::text, 'provisioning'::text, 'running'::text, 'failed'::text, 'terminating'::text, 'cleanup_failed'::text, 'expired'::text])))
);


-- ALTER TABLE public.lab_deployments OWNER TO cyberrange_migrate;

--
-- Name: ops_feed; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.ops_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    message text,
    is_read boolean DEFAULT false NOT NULL,
    assigned_to_user_id uuid,
    escalation text,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.ops_feed OWNER TO cyberrange_migrate;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    gateway text NOT NULL,
    gateway_order_id text NOT NULL,
    gateway_payment_id text,
    amount integer NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    raw_response jsonb,
    created_at timestamp with time zone DEFAULT now()
);


-- ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- ALTER TABLE public.purchases OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_type text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT sessions_session_type_check CHECK ((session_type = ANY (ARRAY['web'::text, 'lab'::text])))
);


-- ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: submissions; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    correct boolean NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    time_spent_seconds integer
);


-- ALTER TABLE public.submissions OWNER TO cyberrange_migrate;

--
-- Name: subnet_pool; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.subnet_pool (
    octet smallint NOT NULL,
    subnet_cidr text NOT NULL,
    status text DEFAULT 'free'::text NOT NULL,
    deployment_id uuid,
    allocated_at timestamp with time zone,
    freed_at timestamp with time zone,
    CONSTRAINT subnet_pool_status_check CHECK ((status = ANY (ARRAY['free'::text, 'in_use'::text])))
);


-- ALTER TABLE public.subnet_pool OWNER TO cyberrange_migrate;

--
-- Name: termination_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.termination_logs (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    resource_id text,
    action text,
    status text,
    reason text,
    project text,
    dry_run boolean,
    created_at timestamp with time zone DEFAULT now()
);


-- ALTER TABLE public.termination_logs OWNER TO postgres;

--
-- Name: termination_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.termination_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.termination_logs_id_seq OWNER TO postgres;

--
-- Name: termination_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.termination_logs_id_seq OWNED BY public.termination_logs.id;


--
-- Name: token_audit_log; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.token_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    jti text NOT NULL,
    event text NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT token_audit_log_event_check CHECK ((event = ANY (ARRAY['issued'::text, 'revoked'::text, 'join_key_issued'::text])))
);


-- ALTER TABLE public.token_audit_log OWNER TO cyberrange_migrate;

--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_id_seq
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.user_id_seq OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sso_provider text NOT NULL,
    sso_subject text NOT NULL,
    email text NOT NULL,
    name text,
    role text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['participant'::text, 'course_admin'::text, 'sys_admin'::text])))
);


-- ALTER TABLE public.users OWNER TO cyberrange_migrate;

--
-- Name: wazuh_subnet_pool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wazuh_subnet_pool (
    octet integer NOT NULL,
    subnet_cidr text NOT NULL,
    status text DEFAULT 'free'::text NOT NULL,
    deployment_id uuid,
    allocated_at timestamp with time zone,
    freed_at timestamp with time zone,
    CONSTRAINT wazuh_subnet_pool_status_check CHECK ((status = ANY (ARRAY['free'::text, 'in_use'::text])))
);


-- ALTER TABLE public.wazuh_subnet_pool OWNER TO postgres;

--
-- Name: worker_status; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.worker_status (
    id text NOT NULL,
    last_seen timestamp with time zone NOT NULL
);


-- ALTER TABLE public.worker_status OWNER TO cyberrange_migrate;

--
-- Name: workshop_course_admins; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.workshop_course_admins (
    workshop_id uuid NOT NULL,
    user_id uuid NOT NULL
);


-- ALTER TABLE public.workshop_course_admins OWNER TO cyberrange_migrate;

--
-- Name: workshop_invites; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.workshop_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workshop_id uuid NOT NULL,
    code text NOT NULL,
    max_uses integer,
    uses_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.workshop_invites OWNER TO cyberrange_migrate;

--
-- Name: workshop_members; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.workshop_members (
    workshop_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.workshop_members OWNER TO cyberrange_migrate;

--
-- Name: workshops; Type: TABLE; Schema: public; Owner: cyberrange_migrate
--

CREATE TABLE public.workshops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    content_id uuid NOT NULL,
    mode text DEFAULT 'delivery'::text NOT NULL,
    seat_cap integer DEFAULT 100 NOT NULL,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    access_policy text DEFAULT 'demo'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- ALTER TABLE public.workshops OWNER TO cyberrange_migrate;

--
-- Name: headscale_keys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_keys ALTER COLUMN id SET DEFAULT nextval('public.headscale_keys_id_seq'::regclass);


--
-- Name: termination_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.termination_logs ALTER COLUMN id SET DEFAULT nextval('public.termination_logs_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: c2_subnet_pool c2_subnet_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.c2_subnet_pool
    ADD CONSTRAINT c2_subnet_pool_pkey PRIMARY KEY (octet);


--
-- Name: c2_subnet_pool c2_subnet_pool_subnet_cidr_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.c2_subnet_pool
    ADD CONSTRAINT c2_subnet_pool_subnet_cidr_key UNIQUE (subnet_cidr);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: cohort_runs cohort_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.cohort_runs
    ADD CONSTRAINT cohort_runs_pkey PRIMARY KEY (id);


--
-- Name: content_items content_items_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_pkey PRIMARY KEY (id);


--
-- Name: content_page_revisions content_page_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_page_revisions
    ADD CONSTRAINT content_page_revisions_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_slug_key UNIQUE (slug);


--
-- Name: content_prices content_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_prices
    ADD CONSTRAINT content_prices_pkey PRIMARY KEY (content_id);


--
-- Name: content_sections content_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_sections
    ADD CONSTRAINT content_sections_pkey PRIMARY KEY (id);


--
-- Name: course_admin_assignments course_admin_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_admin_assignments
    ADD CONSTRAINT course_admin_assignments_pkey PRIMARY KEY (user_id, content_id);


--
-- Name: course_guardrails course_guardrails_course_admin_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_guardrails
    ADD CONSTRAINT course_guardrails_course_admin_id_content_id_key UNIQUE (course_admin_id, content_id);


--
-- Name: course_guardrails course_guardrails_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_guardrails
    ADD CONSTRAINT course_guardrails_pkey PRIMARY KEY (id);


--
-- Name: course_participants course_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_participants
    ADD CONSTRAINT course_participants_pkey PRIMARY KEY (user_id, content_id);


--
-- Name: deployment_members deployment_members_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.deployment_members
    ADD CONSTRAINT deployment_members_pkey PRIMARY KEY (deployment_id, user_id);


--
-- Name: entitlements entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (id);


--
-- Name: entitlements entitlements_user_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_content_id_key UNIQUE (user_id, content_id);


--
-- Name: headscale_identities headscale_identities_headscale_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_identities
    ADD CONSTRAINT headscale_identities_headscale_user_id_key UNIQUE (headscale_user_id);


--
-- Name: headscale_identities headscale_identities_headscale_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_identities
    ADD CONSTRAINT headscale_identities_headscale_username_key UNIQUE (headscale_username);


--
-- Name: headscale_identities headscale_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_identities
    ADD CONSTRAINT headscale_identities_pkey PRIMARY KEY (user_id);


--
-- Name: headscale_keys headscale_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_keys
    ADD CONSTRAINT headscale_keys_pkey PRIMARY KEY (id);


--
-- Name: lab_deployments lab_deployments_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.lab_deployments
    ADD CONSTRAINT lab_deployments_pkey PRIMARY KEY (id);


--
-- Name: ops_feed ops_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.ops_feed
    ADD CONSTRAINT ops_feed_pkey PRIMARY KEY (id);


--
-- Name: payments payments_gateway_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_gateway_order_id_key UNIQUE (gateway_order_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_user_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_content_id_key UNIQUE (user_id, content_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: subnet_pool subnet_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.subnet_pool
    ADD CONSTRAINT subnet_pool_pkey PRIMARY KEY (octet);


--
-- Name: subnet_pool subnet_pool_subnet_cidr_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.subnet_pool
    ADD CONSTRAINT subnet_pool_subnet_cidr_key UNIQUE (subnet_cidr);


--
-- Name: termination_logs termination_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.termination_logs
    ADD CONSTRAINT termination_logs_pkey PRIMARY KEY (id);


--
-- Name: token_audit_log token_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.token_audit_log
    ADD CONSTRAINT token_audit_log_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_sso_provider_sso_subject_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_sso_provider_sso_subject_key UNIQUE (sso_provider, sso_subject);


--
-- Name: wazuh_subnet_pool wazuh_subnet_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wazuh_subnet_pool
    ADD CONSTRAINT wazuh_subnet_pool_pkey PRIMARY KEY (octet);


--
-- Name: wazuh_subnet_pool wazuh_subnet_pool_subnet_cidr_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wazuh_subnet_pool
    ADD CONSTRAINT wazuh_subnet_pool_subnet_cidr_key UNIQUE (subnet_cidr);


--
-- Name: worker_status worker_status_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.worker_status
    ADD CONSTRAINT worker_status_pkey PRIMARY KEY (id);


--
-- Name: workshop_course_admins workshop_course_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_course_admins
    ADD CONSTRAINT workshop_course_admins_pkey PRIMARY KEY (workshop_id, user_id);


--
-- Name: workshop_invites workshop_invites_code_key; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_invites
    ADD CONSTRAINT workshop_invites_code_key UNIQUE (code);


--
-- Name: workshop_invites workshop_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_invites
    ADD CONSTRAINT workshop_invites_pkey PRIMARY KEY (id);


--
-- Name: workshop_members workshop_members_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_members
    ADD CONSTRAINT workshop_members_pkey PRIMARY KEY (workshop_id, user_id);


--
-- Name: workshops workshops_pkey; Type: CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshops
    ADD CONSTRAINT workshops_pkey PRIMARY KEY (id);


--
-- Name: idx_course_admin_assignments_content_id; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_course_admin_assignments_content_id ON public.course_admin_assignments USING btree (content_id);


--
-- Name: idx_course_participants_content_id; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_course_participants_content_id ON public.course_participants USING btree (content_id);


--
-- Name: idx_deployment_members_deployment_id; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_deployment_members_deployment_id ON public.deployment_members USING btree (deployment_id);


--
-- Name: idx_deployment_members_user_id; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_deployment_members_user_id ON public.deployment_members USING btree (user_id);


--
-- Name: idx_headscale_identities_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_headscale_identities_user_id ON public.headscale_identities USING btree (user_id);


--
-- Name: idx_headscale_keys_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_headscale_keys_user_id ON public.headscale_keys USING btree (user_id);


--
-- Name: idx_lab_expires; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_lab_expires ON public.lab_deployments USING btree (expires_at);


--
-- Name: idx_lab_status_created; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_lab_status_created ON public.lab_deployments USING btree (status, created_at);


--
-- Name: idx_lab_status_expires; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_lab_status_expires ON public.lab_deployments USING btree (status, expires_at);


--
-- Name: idx_lab_user; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_lab_user ON public.lab_deployments USING btree (user_id);


--
-- Name: idx_submissions_challenge_user; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_submissions_challenge_user ON public.submissions USING btree (challenge_id, user_id);


--
-- Name: idx_subnet_pool_status; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_subnet_pool_status ON public.subnet_pool USING btree (status);


--
-- Name: idx_token_audit_created_at; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_token_audit_created_at ON public.token_audit_log USING btree (created_at DESC);


--
-- Name: idx_token_audit_jti; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_token_audit_jti ON public.token_audit_log USING btree (jti);


--
-- Name: idx_token_audit_user_id; Type: INDEX; Schema: public; Owner: cyberrange_migrate
--

CREATE INDEX idx_token_audit_user_id ON public.token_audit_log USING btree (user_id);


--
-- Name: idx_wazuh_subnet_pool_deployment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wazuh_subnet_pool_deployment_id ON public.wazuh_subnet_pool USING btree (deployment_id) WHERE (deployment_id IS NOT NULL);


--
-- Name: idx_wazuh_subnet_pool_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wazuh_subnet_pool_status ON public.wazuh_subnet_pool USING btree (status);


--
-- Name: c2_subnet_pool c2_subnet_pool_deployment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.c2_subnet_pool
    ADD CONSTRAINT c2_subnet_pool_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES public.lab_deployments(id) ON DELETE SET NULL;


--
-- Name: challenges challenges_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: cohort_runs cohort_runs_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.cohort_runs
    ADD CONSTRAINT cohort_runs_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: cohort_runs cohort_runs_workshop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.cohort_runs
    ADD CONSTRAINT cohort_runs_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE;


--
-- Name: content_page_revisions content_page_revisions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_page_revisions
    ADD CONSTRAINT content_page_revisions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_page_revisions content_page_revisions_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_page_revisions
    ADD CONSTRAINT content_page_revisions_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.content_pages(id) ON DELETE CASCADE;


--
-- Name: content_prices content_prices_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_prices
    ADD CONSTRAINT content_prices_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: content_sections content_sections_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.content_sections
    ADD CONSTRAINT content_sections_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.content_pages(id) ON DELETE CASCADE;


--
-- Name: course_admin_assignments course_admin_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_admin_assignments
    ADD CONSTRAINT course_admin_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: course_admin_assignments course_admin_assignments_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_admin_assignments
    ADD CONSTRAINT course_admin_assignments_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: course_admin_assignments course_admin_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_admin_assignments
    ADD CONSTRAINT course_admin_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: course_guardrails course_guardrails_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_guardrails
    ADD CONSTRAINT course_guardrails_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: course_guardrails course_guardrails_course_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_guardrails
    ADD CONSTRAINT course_guardrails_course_admin_id_fkey FOREIGN KEY (course_admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: course_guardrails course_guardrails_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_guardrails
    ADD CONSTRAINT course_guardrails_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.users(id);


--
-- Name: course_participants course_participants_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_participants
    ADD CONSTRAINT course_participants_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: course_participants course_participants_enrolled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_participants
    ADD CONSTRAINT course_participants_enrolled_by_fkey FOREIGN KEY (enrolled_by) REFERENCES public.users(id);


--
-- Name: course_participants course_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.course_participants
    ADD CONSTRAINT course_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: deployment_members deployment_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.deployment_members
    ADD CONSTRAINT deployment_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: deployment_members deployment_members_deployment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.deployment_members
    ADD CONSTRAINT deployment_members_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES public.lab_deployments(id) ON DELETE CASCADE;


--
-- Name: deployment_members deployment_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.deployment_members
    ADD CONSTRAINT deployment_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: entitlements entitlements_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id);


--
-- Name: entitlements entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: headscale_identities headscale_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_identities
    ADD CONSTRAINT headscale_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: headscale_keys headscale_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headscale_keys
    ADD CONSTRAINT headscale_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lab_deployments lab_deployments_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.lab_deployments
    ADD CONSTRAINT lab_deployments_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: lab_deployments lab_deployments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.lab_deployments
    ADD CONSTRAINT lab_deployments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ops_feed ops_feed_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.ops_feed
    ADD CONSTRAINT ops_feed_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ops_feed ops_feed_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.ops_feed
    ADD CONSTRAINT ops_feed_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: purchases purchases_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id);


--
-- Name: purchases purchases_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: purchases purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: submissions submissions_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subnet_pool subnet_pool_deployment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.subnet_pool
    ADD CONSTRAINT subnet_pool_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES public.lab_deployments(id) ON DELETE SET NULL;


--
-- Name: token_audit_log token_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.token_audit_log
    ADD CONSTRAINT token_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wazuh_subnet_pool wazuh_subnet_pool_deployment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wazuh_subnet_pool
    ADD CONSTRAINT wazuh_subnet_pool_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES public.lab_deployments(id) ON DELETE SET NULL;


--
-- Name: workshop_course_admins workshop_course_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_course_admins
    ADD CONSTRAINT workshop_course_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workshop_course_admins workshop_course_admins_workshop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_course_admins
    ADD CONSTRAINT workshop_course_admins_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE;


--
-- Name: workshop_invites workshop_invites_workshop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_invites
    ADD CONSTRAINT workshop_invites_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE;


--
-- Name: workshop_members workshop_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_members
    ADD CONSTRAINT workshop_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workshop_members workshop_members_workshop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshop_members
    ADD CONSTRAINT workshop_members_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id) ON DELETE CASCADE;


--
-- Name: workshops workshops_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshops
    ADD CONSTRAINT workshops_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_items(id) ON DELETE CASCADE;


--
-- Name: workshops workshops_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cyberrange_migrate
--

ALTER TABLE ONLY public.workshops
    ADD CONSTRAINT workshops_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

-- GRANT USAGE ON SCHEMA public TO cyberrange_app;
-- GRANT ALL ON SCHEMA public TO cyberrange_migrate;


--
-- Name: TABLE alembic_version; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.alembic_version TO cyberrange_app;


--
-- Name: TABLE content_items; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_items TO cyberrange_app;


--
-- Name: TABLE course_admin_assignments; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.course_admin_assignments TO cyberrange_app;


--
-- Name: TABLE course_guardrails; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.course_guardrails TO cyberrange_app;


--
-- Name: TABLE course_participants; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.course_participants TO cyberrange_app;


--
-- Name: TABLE deployment_members; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deployment_members TO cyberrange_app;


--
-- Name: TABLE entitlements; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.entitlements TO cyberrange_app;


--
-- Name: TABLE headscale_identities; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.headscale_identities TO cyberrange_app;
-- GRANT ALL ON TABLE public.headscale_identities TO cyberrange_migrate;


--
-- Name: TABLE headscale_keys; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.headscale_keys TO cyberrange_app;
-- GRANT ALL ON TABLE public.headscale_keys TO cyberrange_migrate;


--
-- Name: SEQUENCE headscale_keys_id_seq; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,USAGE ON SEQUENCE public.headscale_keys_id_seq TO cyberrange_app;
-- GRANT ALL ON SEQUENCE public.headscale_keys_id_seq TO cyberrange_migrate;


--
-- Name: TABLE lab_deployments; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lab_deployments TO cyberrange_app;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payments TO cyberrange_app;
-- GRANT ALL ON TABLE public.payments TO cyberrange_migrate;


--
-- Name: TABLE purchases; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.purchases TO cyberrange_app;
-- GRANT ALL ON TABLE public.purchases TO cyberrange_migrate;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sessions TO cyberrange_app;
-- GRANT ALL ON TABLE public.sessions TO cyberrange_migrate;


--
-- Name: TABLE subnet_pool; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.subnet_pool TO cyberrange_app;


--
-- Name: TABLE termination_logs; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.termination_logs TO cyberrange_app;
-- GRANT ALL ON TABLE public.termination_logs TO cyberrange_migrate;


--
-- Name: SEQUENCE termination_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,USAGE ON SEQUENCE public.termination_logs_id_seq TO cyberrange_app;
-- GRANT ALL ON SEQUENCE public.termination_logs_id_seq TO cyberrange_migrate;


--
-- Name: TABLE token_audit_log; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.token_audit_log TO cyberrange_app;


--
-- Name: SEQUENCE user_id_seq; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,USAGE ON SEQUENCE public.user_id_seq TO cyberrange_app;
-- GRANT ALL ON SEQUENCE public.user_id_seq TO cyberrange_migrate;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO cyberrange_app;


--
-- Name: TABLE wazuh_subnet_pool; Type: ACL; Schema: public; Owner: postgres
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.wazuh_subnet_pool TO cyberrange_app;
-- GRANT ALL ON TABLE public.wazuh_subnet_pool TO cyberrange_migrate;


--
-- Name: TABLE worker_status; Type: ACL; Schema: public; Owner: cyberrange_migrate
--

-- GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.worker_status TO cyberrange_app;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO cyberrange_app;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO cyberrange_migrate;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO cyberrange_app;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO cyberrange_migrate;


--
-- PostgreSQL database dump complete
--

-- \unrestrict aBKBEHovuLjQ7xhNGPpYzvp2TNZrt3dDTlDgaofa0TcQc9paXorhKrrqIbwuqJL

