--
-- PostgreSQL database dump
--

\restrict 1t1dTPXi6Ruo0ixLVValF3AEQSIGGJszseJg1JffE6WwakWk3ej6HPUh092Oio8

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: action_item_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_item_comments (
    id uuid NOT NULL,
    action_item_id uuid NOT NULL,
    author_participant_id uuid,
    author_user_id uuid,
    content text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: action_item_external_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_item_external_links (
    id uuid NOT NULL,
    action_item_id uuid NOT NULL,
    source character varying(20) NOT NULL,
    external_site character varying(100) NOT NULL,
    external_id character varying(100) NOT NULL,
    external_key character varying(150) NOT NULL,
    external_url character varying(2048) NOT NULL,
    created_by_user_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    external_state character varying(10),
    external_status_name character varying(100),
    external_updated_at timestamp(0) without time zone,
    local_state_changed_at timestamp(0) without time zone,
    last_pushed_state character varying(10),
    last_pushed_at timestamp(0) without time zone,
    last_synced_at timestamp(0) without time zone,
    sync_error character varying(500),
    missing_at timestamp(0) without time zone
);


--
-- Name: action_item_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_item_reminders (
    id uuid NOT NULL,
    action_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind character varying(255) NOT NULL,
    due_on date NOT NULL,
    sent_at timestamp(0) without time zone NOT NULL
);


--
-- Name: action_item_subtasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_item_subtasks (
    id uuid NOT NULL,
    action_item_id uuid NOT NULL,
    content character varying(200) NOT NULL,
    "position" integer NOT NULL,
    completed_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_items (
    id uuid NOT NULL,
    retro_id uuid,
    content character varying(500) NOT NULL,
    assignee_participant_id uuid,
    created_by_participant_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    theme_id uuid,
    theme_name character varying(80),
    team_id uuid NOT NULL,
    priority character varying(255) DEFAULT 'medium'::character varying NOT NULL,
    due_on date,
    completed_at timestamp(0) without time zone,
    assignee_user_id uuid,
    created_by_user_id uuid,
    recurrence character varying(255),
    previous_occurrence_id uuid,
    completed_via_source character varying(20),
    CONSTRAINT action_items_guest_assignee_needs_retro CHECK (((retro_id IS NOT NULL) OR (assignee_participant_id IS NULL))),
    CONSTRAINT action_items_recurrence_needs_due_date CHECK (((recurrence IS NULL) OR (due_on IS NOT NULL))),
    CONSTRAINT action_items_single_assignee CHECK (((assignee_user_id IS NULL) OR (assignee_participant_id IS NULL)))
);


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: card_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_comments (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    card_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    parent_comment_id uuid,
    content text,
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: card_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_reactions (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    card_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    emoji character varying(64) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cards (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    column_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    content text,
    "position" integer DEFAULT 0 NOT NULL,
    parent_card_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    gif_id character varying(64),
    group_name character varying(60),
    sentiment character varying(255),
    category character varying(40)
);


--
-- Name: columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.columns (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    color character varying(16) NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    description character varying(200)
);


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection character varying(255) NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: game_gif_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_gif_answers (
    id uuid NOT NULL,
    game_round_id uuid NOT NULL,
    player_id uuid NOT NULL,
    gif_id character varying(64) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: game_gif_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_gif_votes (
    id uuid NOT NULL,
    game_round_id uuid NOT NULL,
    voter_player_id uuid NOT NULL,
    answer_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: game_guesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_guesses (
    id uuid NOT NULL,
    game_round_id uuid NOT NULL,
    player_id uuid NOT NULL,
    text character varying(50) NOT NULL,
    is_near_miss boolean DEFAULT false NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: game_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_players (
    id uuid NOT NULL,
    game_room_id uuid NOT NULL,
    user_id uuid,
    participant_id uuid,
    guest_name character varying(50),
    guest_secret_hash character varying(64),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: game_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_points (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    game_room_id uuid NOT NULL,
    game_round_id uuid,
    player_id uuid NOT NULL,
    user_id uuid,
    game character varying(20) NOT NULL,
    points smallint NOT NULL,
    is_win boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone NOT NULL
);


--
-- Name: game_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_rooms (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    retro_id uuid,
    name character varying(60),
    created_by_user_id uuid,
    host_player_id uuid,
    game character varying(20) DEFAULT 'draw'::character varying NOT NULL,
    locale character varying(5) NOT NULL,
    access character varying(10) DEFAULT 'team'::character varying NOT NULL,
    guest_token character varying(40) NOT NULL,
    timer_ends_at timestamp(0) without time zone,
    current_round_id uuid,
    scores_reset_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reactions_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: game_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_rounds (
    id uuid NOT NULL,
    game_room_id uuid NOT NULL,
    game character varying(20) NOT NULL,
    leader_player_id uuid,
    word character varying(24),
    revealed_positions jsonb DEFAULT '[]'::jsonb NOT NULL,
    picked_letters jsonb DEFAULT '[]'::jsonb NOT NULL,
    picked_by jsonb DEFAULT '[]'::jsonb NOT NULL,
    misses smallint DEFAULT '0'::smallint NOT NULL,
    clue jsonb DEFAULT '[]'::jsonb NOT NULL,
    question character varying(200),
    drawing jsonb DEFAULT '[]'::jsonb NOT NULL,
    drawing_points integer DEFAULT 0 NOT NULL,
    winner_player_id uuid,
    revealed_at timestamp(0) without time zone,
    outcome character varying(20),
    started_at timestamp(0) without time zone NOT NULL,
    ended_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: game_used_words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_used_words (
    team_id uuid NOT NULL,
    locale character varying(5) NOT NULL,
    word character varying(24) NOT NULL,
    created_at timestamp(0) without time zone NOT NULL
);


--
-- Name: health_check_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.health_check_answers (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    statement character varying(64) NOT NULL,
    score smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: instance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instance_settings (
    id uuid NOT NULL,
    key character varying(255) NOT NULL,
    value json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: integration_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_deliveries (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    channel character varying(20) NOT NULL,
    kind character varying(30) NOT NULL,
    subject_type character varying(255) NOT NULL,
    subject_id uuid NOT NULL,
    requested_by_user_id uuid,
    status character varying(10) NOT NULL,
    recipient_count integer,
    error character varying(500),
    sent_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    team_integration_id uuid,
    event character varying(60),
    attempts smallint DEFAULT '0'::smallint NOT NULL,
    response_status smallint,
    last_attempt_at timestamp(0) without time zone,
    redelivery_of_id uuid
);


--
-- Name: integration_delivery_payloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_delivery_payloads (
    id uuid NOT NULL,
    integration_delivery_id uuid NOT NULL,
    message text NOT NULL,
    request_headers text,
    request_body text,
    response_status smallint,
    response_excerpt text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: integration_inbound_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_inbound_events (
    id uuid NOT NULL,
    provider character varying(20) NOT NULL,
    team_integration_id uuid,
    event_key character varying(191) NOT NULL,
    event_type character varying(100) NOT NULL,
    status character varying(10) NOT NULL,
    detail character varying(500),
    received_at timestamp(0) without time zone NOT NULL
);


--
-- Name: integration_user_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_user_mappings (
    id uuid NOT NULL,
    team_integration_id uuid NOT NULL,
    user_id uuid NOT NULL,
    external_account_id character varying(128),
    external_display_name character varying(255),
    matched_by character varying(20) NOT NULL,
    checked_at timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    account_inactive boolean DEFAULT false NOT NULL
);


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    type character varying(255) NOT NULL,
    notifiable_type character varying(255) NOT NULL,
    notifiable_id uuid NOT NULL,
    data json NOT NULL,
    read_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participants (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    user_id uuid,
    guest_name character varying(50),
    guest_secret_hash character varying(64),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: passkeys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passkeys (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    credential_id character varying(255) NOT NULL,
    credential json NOT NULL,
    last_used_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_access_tokens (
    id uuid NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id uuid NOT NULL,
    name character varying(60) NOT NULL,
    token character varying(64) NOT NULL,
    abilities json NOT NULL,
    team_id uuid,
    token_hint character varying(4) NOT NULL,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: poker_decks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poker_decks (
    id uuid NOT NULL,
    team_id uuid,
    name character varying(40) NOT NULL,
    cards json NOT NULL,
    created_by_user_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    workspace_id uuid,
    CONSTRAINT poker_decks_single_owner CHECK (((team_id IS NULL) <> (workspace_id IS NULL)))
);


--
-- Name: poker_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poker_games (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    title character varying(120) NOT NULL,
    deck character varying(30) NOT NULL,
    cards json NOT NULL,
    deck_name character varying(40),
    facilitator_player_id uuid,
    current_task_id uuid,
    guest_access_enabled boolean DEFAULT false NOT NULL,
    guest_token character varying(40) NOT NULL,
    ended_at timestamp(0) without time zone,
    auto_reveal boolean DEFAULT false NOT NULL,
    anonymous_votes boolean DEFAULT false NOT NULL,
    cursors_enabled boolean DEFAULT true NOT NULL,
    reactions_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    saved_deck_id uuid
);


--
-- Name: poker_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poker_players (
    id uuid NOT NULL,
    poker_game_id uuid NOT NULL,
    user_id uuid,
    guest_name character varying(50),
    guest_secret_hash character varying(64),
    is_spectator boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: poker_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poker_rounds (
    id uuid NOT NULL,
    poker_task_id uuid NOT NULL,
    number integer NOT NULL,
    revealed_at timestamp(0) without time zone,
    version integer DEFAULT 0 NOT NULL,
    anonymous boolean DEFAULT false NOT NULL,
    timer_ends_at timestamp(0) without time zone,
    reveal_reason character varying(20),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: poker_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poker_tasks (
    id uuid NOT NULL,
    poker_game_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    "position" integer NOT NULL,
    estimate character varying(8),
    estimate_numeric numeric(8,2),
    estimated_at timestamp(0) without time zone,
    external_source character varying(20),
    external_id character varying(100),
    external_url character varying(2048),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    external_site character varying(100),
    external_key character varying(150),
    external_assignee character varying(100),
    external_estimate character varying(16),
    external_refreshed_at timestamp(0) without time zone,
    needs_sync boolean DEFAULT false NOT NULL,
    sync_error character varying(500),
    synced_at timestamp(0) without time zone,
    external_status_name character varying(100),
    external_status_category character varying(20),
    external_updated_at timestamp(0) without time zone,
    external_missing_at timestamp(0) without time zone
);


--
-- Name: poker_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.poker_votes (
    id uuid NOT NULL,
    poker_round_id uuid NOT NULL,
    poker_player_id uuid NOT NULL,
    value character varying(8) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: retro_health_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_health_statements (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    key character varying(64) NOT NULL,
    team_health_statement_id uuid,
    builtin character varying(255),
    text character varying(150),
    label character varying(30),
    "position" smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: retro_theme_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_theme_cards (
    theme_id uuid NOT NULL,
    card_id uuid NOT NULL
);


--
-- Name: retro_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retro_themes (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    "position" smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: retros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retros (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    title character varying(120) NOT NULL,
    template character varying(255) NOT NULL,
    phase character varying(255) DEFAULT 'writing'::character varying NOT NULL,
    facilitator_participant_id uuid,
    is_anonymous boolean DEFAULT false NOT NULL,
    votes_per_participant smallint,
    guest_access_enabled boolean DEFAULT false NOT NULL,
    guest_token character varying(64) NOT NULL,
    timer_ends_at timestamp(0) without time zone,
    highlighted_card_id uuid,
    completed_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    votes_version integer DEFAULT 0 NOT NULL,
    reactions_enabled boolean DEFAULT true NOT NULL,
    cursors_enabled boolean DEFAULT true NOT NULL,
    gifs_enabled boolean DEFAULT true NOT NULL,
    hide_vote_counts boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    presentation_mode boolean DEFAULT false NOT NULL,
    health_check_enabled boolean DEFAULT false NOT NULL,
    icebreaker_enabled boolean DEFAULT false NOT NULL,
    workspace_template_id uuid,
    ai_summary_enabled boolean DEFAULT false NOT NULL,
    summary text,
    summary_generated_at timestamp(0) without time zone,
    summary_status character varying(255),
    summary_requested_at timestamp(0) without time zone,
    icebreaker_game character varying(20) DEFAULT 'draw'::character varying NOT NULL,
    started_at timestamp(0) without time zone
);


--
-- Name: roti_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roti_votes (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    score smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id uuid,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: social_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_accounts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(255) NOT NULL,
    provider_user_id character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: suggested_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suggested_actions (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    theme_id uuid,
    content character varying(500) NOT NULL,
    "position" smallint NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    action_item_id uuid,
    handled_by_participant_id uuid,
    handled_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: survey_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_comments (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    survey_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    parent_comment_id uuid,
    content text,
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: survey_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_options (
    id uuid NOT NULL,
    survey_id uuid NOT NULL,
    label character varying(100) NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: survey_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_reactions (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    survey_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    emoji character varying(64) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    id uuid NOT NULL,
    survey_id uuid NOT NULL,
    survey_option_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: survey_text_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_text_answers (
    id uuid NOT NULL,
    survey_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    created_by_participant_id uuid,
    kind character varying(255) DEFAULT 'single'::character varying NOT NULL,
    question character varying(200) NOT NULL,
    description character varying(500),
    "position" integer NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    show_voters boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: team_health_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_health_statements (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    builtin character varying(255),
    text character varying(150),
    label character varying(30),
    "position" smallint NOT NULL,
    archived_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT team_health_statements_builtin_or_custom CHECK ((((builtin IS NOT NULL) AND (text IS NULL) AND (label IS NULL)) OR ((builtin IS NULL) AND (text IS NOT NULL) AND (label IS NOT NULL))))
);


--
-- Name: team_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_integrations (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    provider character varying(20) NOT NULL,
    status character varying(30) NOT NULL,
    access character varying(10) NOT NULL,
    credentials text NOT NULL,
    settings json NOT NULL,
    scopes json NOT NULL,
    connected_by_user_id uuid,
    last_error character varying(500),
    last_checked_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    inbound_mode character varying(10) DEFAULT 'off'::character varying NOT NULL,
    webhook_status character varying(10),
    webhook_expires_at timestamp(0) without time zone,
    last_inbound_at timestamp(0) without time zone,
    last_polled_at timestamp(0) without time zone,
    poll_cursor timestamp(0) without time zone,
    consecutive_failures integer DEFAULT 0 NOT NULL,
    last_delivery_succeeded_at timestamp(0) without time zone
);


--
-- Name: team_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_user (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    default_poker_deck character varying(30),
    default_saved_poker_deck_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    two_factor_secret text,
    two_factor_recovery_codes text,
    two_factor_confirmed_at timestamp(0) without time zone,
    locale character varying(5),
    is_instance_admin boolean DEFAULT false NOT NULL,
    current_workspace_id uuid,
    action_item_reminders_by_email boolean DEFAULT true NOT NULL,
    action_item_reminders_in_app boolean DEFAULT true NOT NULL,
    avatar_style character varying(255)
);


--
-- Name: votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.votes (
    id uuid NOT NULL,
    retro_id uuid NOT NULL,
    card_id uuid NOT NULL,
    participant_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: whiteboard_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whiteboard_elements (
    id uuid NOT NULL,
    whiteboard_id uuid NOT NULL,
    element_id character varying(40) NOT NULL,
    type character varying(20) NOT NULL,
    data json NOT NULL,
    version integer NOT NULL,
    version_nonce bigint NOT NULL,
    author_member_id uuid,
    is_sticky boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    seq bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: whiteboard_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whiteboard_files (
    id uuid NOT NULL,
    whiteboard_id uuid NOT NULL,
    file_id character varying(64) NOT NULL,
    path character varying(255) NOT NULL,
    mime_type character varying(40) NOT NULL,
    size integer NOT NULL,
    uploaded_by_member_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: whiteboard_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whiteboard_members (
    id uuid NOT NULL,
    whiteboard_id uuid NOT NULL,
    user_id uuid,
    guest_name character varying(50),
    guest_secret_hash character varying(64),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: whiteboard_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whiteboard_templates (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(300),
    scene json NOT NULL,
    preview json NOT NULL,
    created_by_user_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: whiteboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whiteboards (
    id uuid NOT NULL,
    team_id uuid NOT NULL,
    title character varying(120) NOT NULL,
    facilitator_member_id uuid,
    guest_access_enabled boolean DEFAULT false NOT NULL,
    guest_token character varying(40) NOT NULL,
    cursors_enabled boolean DEFAULT true NOT NULL,
    seq bigint DEFAULT '0'::bigint NOT NULL,
    purged_seq bigint DEFAULT '0'::bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reactions_enabled boolean DEFAULT true NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    follow_enabled boolean DEFAULT false NOT NULL,
    timer_ends_at timestamp(0) without time zone
);


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invitations (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(255) NOT NULL,
    token_hash character varying(64) NOT NULL,
    invited_by_id uuid,
    expires_at timestamp(0) without time zone NOT NULL,
    accepted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: workspace_template_columns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_template_columns (
    id uuid NOT NULL,
    workspace_template_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    description character varying(200),
    color character varying(255) NOT NULL,
    "position" smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: workspace_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_templates (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    category character varying(255) NOT NULL,
    created_by_user_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: workspace_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_user (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: action_item_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_item_comments (id, action_item_id, author_participant_id, author_user_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: action_item_external_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_item_external_links (id, action_item_id, source, external_site, external_id, external_key, external_url, created_by_user_id, created_at, updated_at, external_state, external_status_name, external_updated_at, local_state_changed_at, last_pushed_state, last_pushed_at, last_synced_at, sync_error, missing_at) FROM stdin;
\.


--
-- Data for Name: action_item_reminders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_item_reminders (id, action_item_id, user_id, kind, due_on, sent_at) FROM stdin;
\.


--
-- Data for Name: action_item_subtasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_item_subtasks (id, action_item_id, content, "position", completed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: action_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.action_items (id, retro_id, content, assignee_participant_id, created_by_participant_id, created_at, updated_at, theme_id, theme_name, team_id, priority, due_on, completed_at, assignee_user_id, created_by_user_id, recurrence, previous_occurrence_id, completed_via_source) FROM stdin;
01a0fdf4-c7b9-716d-8ed1-7b3712e64c72	01a0fdf4-c7b2-713a-b1e8-6f4a9ac4f214	In ex perferendis qui officia dolor error.	\N	01a0fdf4-c7b4-7378-89e0-f3c26c296b3f	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	01a0fdf4-c7b1-72ec-a188-18c279285281	medium	\N	\N	\N	01a0fdf4-c7b4-7378-89e0-f3c26b4c1b42	\N	\N	\N
01a0fdf4-c7ba-7311-a14b-f5c055abf65d	01a0fdf4-c7b5-7001-bb2b-286c742d200c	Non eum dicta dolore ullam sint praesentium excepturi.	\N	01a0fdf4-c7b6-73c7-9724-09fa1d6c7175	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	01a0fdf4-c7b5-7001-bb2b-286c73777078	medium	\N	\N	\N	01a0fdf4-c7b6-73c7-9724-09fa1d12026c	\N	\N	\N
01a0fdf4-c7ba-7311-a14b-f5c055fdfc66	01a0fdf4-c7b7-7212-ade1-2d310efe0c5a	Omnis at officiis quo quos.	\N	01a0fdf4-c7b8-70c9-b3a7-53f46a8693a1	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	01a0fdf4-c7b7-7212-ade1-2d310ee43915	medium	\N	\N	\N	01a0fdf4-c7b8-70c9-b3a7-53f46a2bef12	\N	\N	\N
\.


--
-- Data for Name: cache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cache (key, value, expiration) FROM stdin;
\.


--
-- Data for Name: cache_locks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cache_locks (key, owner, expiration) FROM stdin;
\.


--
-- Data for Name: card_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.card_comments (id, retro_id, card_id, participant_id, parent_comment_id, content, deleted_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: card_reactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.card_reactions (id, retro_id, card_id, participant_id, emoji, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cards (id, retro_id, column_id, participant_id, content, "position", parent_card_id, created_at, updated_at, gif_id, group_name, sentiment, category) FROM stdin;
01a0fdf4-c7c3-70ad-aa63-a3d1cc89015c	01a0fdf4-c7bc-7023-a552-953c1a1473d5	01a0fdf4-c7bd-717b-9172-82e0ef68ebda	01a0fdf4-c7bf-7390-adf1-501a337cbf8b	Aut illo quia eius non pariatur.	0	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N
01a0fdf4-c7c4-7313-a925-e33b620b7678	01a0fdf4-c7c0-70ad-ad46-f31147359335	01a0fdf4-c7c0-70ad-ad46-f31147bb8706	01a0fdf4-c7c1-706e-8c44-e39871c060b7	Ex ea qui totam iure ad maiores tenetur commodi.	0	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N
01a0fdf4-c7c4-7313-a925-e33b62cd52f7	01a0fdf4-c7c1-706e-8c44-e3987365dd77	01a0fdf4-c7c2-712b-a1f3-ce247b63d733	01a0fdf4-c7c2-712b-a1f3-ce247c7380f7	Ut amet voluptas labore sed necessitatibus.	0	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N
\.


--
-- Data for Name: columns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.columns (id, retro_id, title, color, "position", created_at, updated_at, description) FROM stdin;
01a0fdf4-c7bd-717b-9172-82e0ef68ebda	01a0fdf4-c7bc-7023-a552-953c1a1473d5	voluptatum	green	0	2026-10-02 18:51:12	2026-10-02 18:51:12	\N
01a0fdf4-c7c0-70ad-ad46-f31147bb8706	01a0fdf4-c7c0-70ad-ad46-f31147359335	adipisci	green	0	2026-10-02 18:51:12	2026-10-02 18:51:12	\N
01a0fdf4-c7c2-712b-a1f3-ce247b63d733	01a0fdf4-c7c1-706e-8c44-e3987365dd77	incidunt	green	0	2026-10-02 18:51:12	2026-10-02 18:51:12	\N
\.


--
-- Data for Name: failed_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.failed_jobs (id, uuid, connection, queue, payload, exception, failed_at) FROM stdin;
\.


--
-- Data for Name: game_gif_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_gif_answers (id, game_round_id, player_id, gif_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: game_gif_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_gif_votes (id, game_round_id, voter_player_id, answer_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: game_guesses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_guesses (id, game_round_id, player_id, text, is_near_miss, is_correct, created_at) FROM stdin;
\.


--
-- Data for Name: game_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_players (id, game_room_id, user_id, participant_id, guest_name, guest_secret_hash, created_at, updated_at) FROM stdin;
01a0fdf4-c7a6-7341-b849-0cc847b0792c	01a0fdf4-c7a5-725f-a11d-e5737af2d651	01a0fdf4-c7a5-725f-a11d-e5737b867cb4	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a9-73fe-ade9-58e9159a36c2	01a0fdf4-c7a9-73fe-ade9-58e9149aa90d	01a0fdf4-c7a9-73fe-ade9-58e914b4358f	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7ac-73aa-9d75-89e7d358692d	01a0fdf4-c7ab-726b-bd47-13389a31d9f2	01a0fdf4-c7ac-73aa-9d75-89e7d3093b9b	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Data for Name: game_points; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_points (id, team_id, game_room_id, game_round_id, player_id, user_id, game, points, is_win, created_at) FROM stdin;
01a0fdf4-c7ae-725d-9d73-fd32852fef34	01a0fdf4-c7a3-71e8-8927-11c87d19f281	01a0fdf4-c7a4-7103-9f51-4a6036930d4d	\N	01a0fdf4-c7a6-7341-b849-0cc847b0792c	\N	hangman	0	f	2026-10-02 18:51:12
01a0fdf4-c7af-7375-b085-c2e3c64205cd	01a0fdf4-c7a7-735f-b12b-7d6117a06e73	01a0fdf4-c7a8-72f7-87d2-002f41a5d391	\N	01a0fdf4-c7a9-73fe-ade9-58e9159a36c2	\N	hangman	0	f	2026-10-02 18:51:12
01a0fdf4-c7af-7375-b085-c2e3c65d75cf	01a0fdf4-c7aa-7032-996b-39aa363595f5	01a0fdf4-c7ab-726b-bd47-133897e06445	\N	01a0fdf4-c7ac-73aa-9d75-89e7d358692d	\N	hangman	0	f	2026-10-02 18:51:12
\.


--
-- Data for Name: game_rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_rooms (id, team_id, retro_id, name, created_by_user_id, host_player_id, game, locale, access, guest_token, timer_ends_at, current_round_id, scores_reset_at, created_at, updated_at, reactions_enabled) FROM stdin;
01a0fdf4-c7a0-737c-ab3f-51a427213d5f	01a0fdf4-c79f-72bd-8185-9fa16b8e618d	\N	Quasi nisi tempore voluptas.	\N	\N	hangman	en	team	bgGgkoz5KgMVhrNHnvQNPvl5cyJbTWL4eeuOg4i9	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
01a0fdf4-c7a4-7103-9f51-4a6036930d4d	01a0fdf4-c7a4-7103-9f51-4a6035ca4dd3	\N	In laboriosam reprehenderit quo.	\N	\N	hangman	en	team	cmX4bIw95Bz6uBLd6DF8jQeE1Y6HeVYiNcSDxAcC	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
01a0fdf4-c7a5-725f-a11d-e5737af2d651	01a0fdf4-c7a5-725f-a11d-e5737a6cc041	\N	Voluptas iste enim.	\N	\N	hangman	en	team	0m9tlvgKOJ3r9qUVjIdn6EwIYOgS2fmSNmM52ZyQ	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
01a0fdf4-c7a8-72f7-87d2-002f41a5d391	01a0fdf4-c7a8-72f7-87d2-002f40ca2c63	\N	Provident maxime voluptatum.	\N	\N	hangman	en	team	61XVvUfr3GYZEdoQp5ZwMR9LKsuSmUjMddnwikz2	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
01a0fdf4-c7a9-73fe-ade9-58e9149aa90d	01a0fdf4-c7a8-72f7-87d2-002f42c9e181	\N	Quas ratione debitis.	\N	\N	hangman	en	team	l3AqfnwM7pYBHt4lTyjbjEGp4RRenMQwVklgersW	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
01a0fdf4-c7ab-726b-bd47-133897e06445	01a0fdf4-c7aa-7032-996b-39aa372a577c	\N	Voluptatum vero quae.	\N	\N	hangman	en	team	TPhBowPYVBynHUwydBqNBB7u9IUcttrmGKUtQpGl	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
01a0fdf4-c7ab-726b-bd47-13389a31d9f2	01a0fdf4-c7ab-726b-bd47-13389939fbb4	\N	Earum minima voluptatem rerum.	\N	\N	hangman	en	team	MISMtlt2YpqqpSOHtCBvm3rHm2103wq88eOGgpQF	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	t
\.


--
-- Data for Name: game_rounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_rounds (id, game_room_id, game, leader_player_id, word, revealed_positions, picked_letters, picked_by, misses, clue, question, drawing, drawing_points, winner_player_id, revealed_at, outcome, started_at, ended_at, created_at, updated_at) FROM stdin;
01a0fdf4-c7a1-73a2-8cc4-208be9ab79d6	01a0fdf4-c7a0-737c-ab3f-51a427213d5f	hangman	\N	sprint	[]	[]	[]	0	[]	\N	[]	0	\N	\N	\N	2026-10-02 18:51:12	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Data for Name: game_used_words; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.game_used_words (team_id, locale, word, created_at) FROM stdin;
\.


--
-- Data for Name: health_check_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.health_check_answers (id, retro_id, participant_id, statement, score, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: instance_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.instance_settings (id, key, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: integration_deliveries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integration_deliveries (id, team_id, channel, kind, subject_type, subject_id, requested_by_user_id, status, recipient_count, error, sent_at, created_at, updated_at, team_integration_id, event, attempts, response_status, last_attempt_at, redelivery_of_id) FROM stdin;
\.


--
-- Data for Name: integration_delivery_payloads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integration_delivery_payloads (id, integration_delivery_id, message, request_headers, request_body, response_status, response_excerpt, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: integration_inbound_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integration_inbound_events (id, provider, team_integration_id, event_key, event_type, status, detail, received_at) FROM stdin;
\.


--
-- Data for Name: integration_user_mappings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integration_user_mappings (id, team_integration_id, user_id, external_account_id, external_display_name, matched_by, checked_at, created_at, updated_at, account_inactive) FROM stdin;
\.


--
-- Data for Name: job_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.job_batches (id, name, total_jobs, pending_jobs, failed_jobs, failed_job_ids, options, cancelled_at, created_at, finished_at) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.jobs (id, queue, payload, attempts, reserved_at, available_at, created_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, migration, batch) FROM stdin;
1	0001_01_01_000000_create_users_table	1
2	0001_01_01_000001_create_cache_table	1
3	0001_01_01_000002_create_jobs_table	1
4	2024_01_01_000000_create_passkeys_table	1
5	2025_08_14_170933_add_two_factor_columns_to_users_table	1
6	2026_09_29_104444_add_locale_to_users_table	1
7	2026_09_29_105323_create_workspaces_table	1
8	2026_09_29_105330_create_workspace_user_table	1
9	2026_09_29_105338_add_workspace_columns_to_users_table	1
10	2026_09_29_110028_create_workspace_invitations_table	1
11	2026_09_29_111317_create_teams_table	1
12	2026_09_29_111318_create_team_user_table	1
13	2026_09_29_120125_create_social_accounts_table	1
14	2026_09_29_133044_create_retros_table	1
15	2026_09_29_133045_create_participants_table	1
16	2026_09_29_133047_create_columns_table	1
17	2026_09_29_133048_create_cards_table	1
18	2026_09_29_133050_create_votes_table	1
19	2026_09_29_133051_create_action_items_table	1
20	2026_09_29_133053_add_foreign_keys_to_retros_table	1
21	2026_09_29_133412_add_indexes_to_retro_tables	1
22	2026_09_29_181529_add_votes_version_to_retros_table	1
23	2026_09_30_090000_add_engagement_settings_to_retros_table	1
24	2026_09_30_090100_create_card_reactions_table	1
25	2026_09_30_090200_create_card_comments_table	1
26	2026_09_30_090300_add_gif_to_cards_table	1
27	2026_10_01_100000_add_phase_toggles_to_retros_table	1
28	2026_10_01_100100_make_votes_per_participant_nullable_on_retros_table	1
29	2026_10_01_100200_add_description_to_columns_table	1
30	2026_10_01_100300_create_workspace_templates_table	1
31	2026_10_01_100400_create_workspace_template_columns_table	1
32	2026_10_01_100500_add_workspace_template_id_to_retros_table	1
33	2026_10_01_110000_create_team_health_statements_table	1
34	2026_10_01_110100_create_retro_health_statements_table	1
35	2026_10_01_110200_create_health_check_answers_table	1
36	2026_10_01_120000_create_surveys_table	1
37	2026_10_01_120100_create_survey_options_table	1
38	2026_10_01_120200_create_survey_responses_table	1
39	2026_10_01_120300_create_survey_text_answers_table	1
40	2026_10_01_120400_create_survey_reactions_table	1
41	2026_10_01_120500_create_survey_comments_table	1
42	2026_10_01_130000_create_roti_votes_table	1
43	2026_10_01_130100_add_group_name_to_cards_table	1
44	2026_10_01_140000_add_ai_summary_enabled_to_retros_table	1
45	2026_10_01_140100_add_retro_insights	1
46	2026_10_02_100000_add_v2_columns_to_action_items_table	1
47	2026_10_02_100100_create_action_item_comments_table	1
48	2026_10_02_100200_create_action_item_subtasks_table	1
49	2026_10_02_100300_create_notifications_table	1
50	2026_10_02_100400_add_notification_preferences_to_users_table	1
51	2026_10_02_100500_create_action_item_reminders_table	1
52	2026_10_03_100000_create_poker_tables	1
53	2026_10_03_100100_create_poker_decks_table	1
54	2026_10_04_100000_create_personal_access_tokens_table	1
55	2026_10_05_100000_create_integration_tables	1
56	2026_10_05_100100_add_integration_columns_to_poker_tasks_table	1
57	2026_10_05_100300_add_account_inactive_to_integration_user_mappings_table	1
58	2026_10_06_100000_create_game_tables	1
59	2026_10_06_100100_add_icebreaker_game_to_retros_table	1
60	2026_10_06_100200_drop_updated_at_from_game_guesses_table	1
61	2026_10_07_100000_extend_integration_tables_for_sync_and_channels	1
62	2026_10_07_100200_widen_external_keys_for_repository_issues	1
63	2026_10_07_100300_add_completed_via_source_to_action_items	1
64	2026_10_08_100000_create_integration_delivery_payloads_table	1
65	2026_10_08_100100_index_redelivery_of_on_integration_deliveries	1
66	2026_10_09_100000_create_whiteboard_tables	1
67	2026_10_09_100100_add_reactions_enabled_to_whiteboards_table	1
68	2026_10_10_100000_create_whiteboard_templates_table	1
69	2026_10_11_100000_add_whiteboard_facilitation	1
70	2026_10_12_100000_create_instance_settings_table	1
71	2026_10_13_100000_add_avatar_style_to_users_table	1
72	2026_10_14_100000_add_default_deck_and_usage_to_poker_tables	1
73	2026_10_15_100000_add_workspace_to_poker_decks_table	1
74	2026_10_15_100100_add_started_at_to_retros_table	1
75	2026_10_15_100200_add_reactions_enabled_to_game_rooms_table	1
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, type, notifiable_type, notifiable_id, data, read_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.participants (id, retro_id, user_id, guest_name, guest_secret_hash, created_at, updated_at) FROM stdin;
01a0fdf4-c7b4-7378-89e0-f3c26c296b3f	01a0fdf4-c7b2-713a-b1e8-6f4a9ac4f214	01a0fdf4-c7b4-7378-89e0-f3c26b4c1b42	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7b6-73c7-9724-09fa1d6c7175	01a0fdf4-c7b5-7001-bb2b-286c742d200c	01a0fdf4-c7b6-73c7-9724-09fa1d12026c	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7b8-70c9-b3a7-53f46a8693a1	01a0fdf4-c7b7-7212-ade1-2d310efe0c5a	01a0fdf4-c7b8-70c9-b3a7-53f46a2bef12	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7bf-7390-adf1-501a337cbf8b	01a0fdf4-c7bc-7023-a552-953c1a1473d5	01a0fdf4-c7be-71a6-907b-56c8c5727738	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7c1-706e-8c44-e39871c060b7	01a0fdf4-c7c0-70ad-ad46-f31147359335	01a0fdf4-c7c0-70ad-ad46-f31148af2211	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7c2-712b-a1f3-ce247c7380f7	01a0fdf4-c7c1-706e-8c44-e3987365dd77	01a0fdf4-c7c2-712b-a1f3-ce247bac0a1f	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Data for Name: passkeys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.passkeys (id, user_id, name, credential_id, credential, last_used_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (email, token, created_at) FROM stdin;
\.


--
-- Data for Name: personal_access_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, team_id, token_hint, last_used_at, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: poker_decks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poker_decks (id, team_id, name, cards, created_by_user_id, created_at, updated_at, workspace_id) FROM stdin;
01a0fdf4-c79a-7068-bb20-f0b3f7221778	01a0fdf4-c6bd-71e4-8de0-b22be768f3f5	Scale	["1","2","3","?"]	01a0fdf4-c799-7101-8ae9-3118b56b5b91	2026-10-02 18:51:12	2026-10-02 18:51:12	\N
01a0fdf4-c79c-7317-992f-4c8180740db6	\N	Scale	["1","2","3","?"]	01a0fdf4-c79b-720c-8026-aedc84e2cdc8	2026-10-02 18:51:12	2026-10-02 18:51:12	01a0fdf4-c68c-71e9-b847-b63b1938d3c8
\.


--
-- Data for Name: poker_games; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poker_games (id, team_id, title, deck, cards, deck_name, facilitator_player_id, current_task_id, guest_access_enabled, guest_token, ended_at, auto_reveal, anonymous_votes, cursors_enabled, reactions_enabled, created_at, updated_at, saved_deck_id) FROM stdin;
\.


--
-- Data for Name: poker_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poker_players (id, poker_game_id, user_id, guest_name, guest_secret_hash, is_spectator, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: poker_rounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poker_rounds (id, poker_task_id, number, revealed_at, version, anonymous, timer_ends_at, reveal_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: poker_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poker_tasks (id, poker_game_id, title, description, "position", estimate, estimate_numeric, estimated_at, external_source, external_id, external_url, created_at, updated_at, external_site, external_key, external_assignee, external_estimate, external_refreshed_at, needs_sync, sync_error, synced_at, external_status_name, external_status_category, external_updated_at, external_missing_at) FROM stdin;
\.


--
-- Data for Name: poker_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.poker_votes (id, poker_round_id, poker_player_id, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: retro_health_statements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.retro_health_statements (id, retro_id, key, team_health_statement_id, builtin, text, label, "position", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: retro_theme_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.retro_theme_cards (theme_id, card_id) FROM stdin;
\.


--
-- Data for Name: retro_themes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.retro_themes (id, retro_id, name, "position", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: retros; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.retros (id, team_id, title, template, phase, facilitator_participant_id, is_anonymous, votes_per_participant, guest_access_enabled, guest_token, timer_ends_at, highlighted_card_id, completed_at, created_at, updated_at, votes_version, reactions_enabled, cursors_enabled, gifs_enabled, hide_vote_counts, is_locked, presentation_mode, health_check_enabled, icebreaker_enabled, workspace_template_id, ai_summary_enabled, summary, summary_generated_at, summary_status, summary_requested_at, icebreaker_game, started_at) FROM stdin;
01a0fdf4-c7b2-713a-b1e8-6f4a9ac4f214	01a0fdf4-c7b1-72ec-a188-18c279285281	Est aut voluptatem.	start_stop_continue	writing	\N	f	5	f	HmYlFpYEQbFExUboCDpaExRZqBwdKjJ6ob4djUWq	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	0	t	t	t	f	f	f	f	f	\N	f	\N	\N	\N	\N	draw	\N
01a0fdf4-c7b5-7001-bb2b-286c742d200c	01a0fdf4-c7b5-7001-bb2b-286c73777078	Doloremque quis dolorem.	start_stop_continue	writing	\N	f	5	f	MQqNwoiqaOXps7oKygMfQpMRhWe7qErvoG6djaQn	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	0	t	t	t	f	f	f	f	f	\N	f	\N	\N	\N	\N	draw	\N
01a0fdf4-c7b7-7212-ade1-2d310efe0c5a	01a0fdf4-c7b7-7212-ade1-2d310ee43915	Tenetur ipsum.	start_stop_continue	writing	\N	f	5	f	fod4ydmSpJ50Mcef2VOBWwfRhuj3E2QjQSceD5mk	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	0	t	t	t	f	f	f	f	f	\N	f	\N	\N	\N	\N	draw	\N
01a0fdf4-c7bc-7023-a552-953c1a1473d5	01a0fdf4-c7bc-7023-a552-953c19e15482	Voluptates non et.	start_stop_continue	writing	\N	f	5	f	az51Q51VmtH6wTL6JWVL5NsXxGTouKiwdjVmpPn4	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	0	t	t	t	f	f	f	f	f	\N	f	\N	\N	\N	\N	draw	\N
01a0fdf4-c7c0-70ad-ad46-f31147359335	01a0fdf4-c7bf-7390-adf1-501a34a4c1a5	Aut repudiandae voluptas quia.	start_stop_continue	writing	\N	f	5	f	9iyTl01109tvDwTr9XXAhX7NQIhTtkcYLdTOEA0q	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	0	t	t	t	f	f	f	f	f	\N	f	\N	\N	\N	\N	draw	\N
01a0fdf4-c7c1-706e-8c44-e3987365dd77	01a0fdf4-c7c1-706e-8c44-e39872cfb9a4	Repellat eos in.	start_stop_continue	writing	\N	f	5	f	YEA2azTRaYXiQL2qpUKIiNeEah7lyfC97q91KBzm	\N	\N	\N	2026-10-02 18:51:12	2026-10-02 18:51:12	0	t	t	t	f	f	f	f	f	\N	f	\N	\N	\N	\N	draw	\N
\.


--
-- Data for Name: roti_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roti_votes (id, retro_id, participant_id, score, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, ip_address, user_agent, payload, last_activity) FROM stdin;
\.


--
-- Data for Name: social_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.social_accounts (id, user_id, provider, provider_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suggested_actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suggested_actions (id, retro_id, theme_id, content, "position", status, action_item_id, handled_by_participant_id, handled_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_comments (id, retro_id, survey_id, participant_id, parent_comment_id, content, deleted_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_options (id, survey_id, label, "position", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_reactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_reactions (id, retro_id, survey_id, participant_id, emoji, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_responses (id, survey_id, survey_option_id, participant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: survey_text_answers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_text_answers (id, survey_id, participant_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: surveys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.surveys (id, retro_id, created_by_participant_id, kind, question, description, "position", is_closed, show_voters, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: team_health_statements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.team_health_statements (id, team_id, builtin, text, label, "position", archived_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: team_integrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.team_integrations (id, team_id, provider, status, access, credentials, settings, scopes, connected_by_user_id, last_error, last_checked_at, created_at, updated_at, inbound_mode, webhook_status, webhook_expires_at, last_inbound_at, last_polled_at, poll_cursor, consecutive_failures, last_delivery_succeeded_at) FROM stdin;
\.


--
-- Data for Name: team_user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.team_user (team_id, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.teams (id, workspace_id, name, created_at, updated_at, default_poker_deck, default_saved_poker_deck_id) FROM stdin;
01a0fdf4-c6bd-71e4-8de0-b22be768f3f5	01a0fdf4-c68c-71e9-b847-b63b1938d3c8	alias reprehenderit	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c79f-72bd-8185-9fa16b8e618d	01a0fdf4-c79f-72bd-8185-9fa16b125ac7	magni sunt	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7a3-71e8-8927-11c87d19f281	01a0fdf4-c7a3-71e8-8927-11c87cc4b616	laboriosam illo	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7a4-7103-9f51-4a6035ca4dd3	01a0fdf4-c7a4-7103-9f51-4a6034cfafc0	error minus	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7a5-725f-a11d-e5737a6cc041	01a0fdf4-c7a4-7103-9f51-4a60376e3a67	reprehenderit rem	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7a7-735f-b12b-7d6117a06e73	01a0fdf4-c7a7-735f-b12b-7d6117521774	et est	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7a8-72f7-87d2-002f40ca2c63	01a0fdf4-c7a7-735f-b12b-7d6117a12fd2	odio doloribus	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7a8-72f7-87d2-002f42c9e181	01a0fdf4-c7a8-72f7-87d2-002f41ff0729	eaque ipsa	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7aa-7032-996b-39aa363595f5	01a0fdf4-c7aa-7032-996b-39aa35ad49c3	quaerat repellendus	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7aa-7032-996b-39aa372a577c	01a0fdf4-c7aa-7032-996b-39aa367327b9	maxime pariatur	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7ab-726b-bd47-13389939fbb4	01a0fdf4-c7ab-726b-bd47-1338983f1652	ad nesciunt	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7b1-72ec-a188-18c279285281	01a0fdf4-c7b1-72ec-a188-18c278e44913	voluptate expedita	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7b5-7001-bb2b-286c73777078	01a0fdf4-c7b5-7001-bb2b-286c729967b0	ut illo	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7b7-7212-ade1-2d310ee43915	01a0fdf4-c7b7-7212-ade1-2d310e4f8279	omnis quas	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7bc-7023-a552-953c19e15482	01a0fdf4-c7bc-7023-a552-953c1970f4ec	et maxime	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7bf-7390-adf1-501a34a4c1a5	01a0fdf4-c7bf-7390-adf1-501a3465d91a	iusto quis	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
01a0fdf4-c7c1-706e-8c44-e39872cfb9a4	01a0fdf4-c7c1-706e-8c44-e398727e42fa	corporis tenetur	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, email_verified_at, password, remember_token, created_at, updated_at, two_factor_secret, two_factor_recovery_codes, two_factor_confirmed_at, locale, is_instance_admin, current_workspace_id, action_item_reminders_by_email, action_item_reminders_in_app, avatar_style) FROM stdin;
01a0fdf4-c795-7276-916b-1f084312b68e	Morgan Hammes DVM	watsica.otilia@example.net	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	fg9L3RtGRY	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c799-7101-8ae9-3118b56b5b91	Mrs. Maritza Zulauf IV	berta.romaguera@example.net	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	aPpfJT66iS	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c79b-720c-8026-aedc84e2cdc8	Dr. Mable Hermiston	letitia77@example.net	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	9XEgRmkvFJ	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7a5-725f-a11d-e5737b867cb4	Dr. Mortimer Hartmann	leopold.kessler@example.com	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	PnjwxYvdDq	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7a9-73fe-ade9-58e914b4358f	Jody Zulauf	brionna.haag@example.org	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	z2sGfwOtc0	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7ac-73aa-9d75-89e7d3093b9b	Emmanuelle Hegmann MD	oberbrunner.brittany@example.com	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	QbPivgSOEW	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7b4-7378-89e0-f3c26b4c1b42	Janis Mueller	leffler.hailie@example.com	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	h3NhgZtXYJ	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7b6-73c7-9724-09fa1d12026c	Brigitte Muller	jeanette.wiza@example.com	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	5c0C5n3h0c	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7b8-70c9-b3a7-53f46a2bef12	Selena Wolff	zroberts@example.org	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	3yxEnfxQ6j	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7be-71a6-907b-56c8c5727738	Dr. Ed Reichel	nina.wisozk@example.org	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	cV3qmtj1iU	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7c0-70ad-ad46-f31148af2211	Malika Boyle	otho.crooks@example.net	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	k2BfwocfCq	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
01a0fdf4-c7c2-712b-a1f3-ce247bac0a1f	Noel Ortiz	ernie97@example.org	2026-10-02 18:51:12	$2y$12$yb/o84tfB2l/XUELq15Gwupb4H1djDa1/ZxcaPfxEo.0QAEXJAP7O	TzlbNFmIc9	2026-10-02 18:51:12	2026-10-02 18:51:12	\N	\N	\N	\N	f	\N	t	t	\N
\.


--
-- Data for Name: votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.votes (id, retro_id, card_id, participant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: whiteboard_elements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whiteboard_elements (id, whiteboard_id, element_id, type, data, version, version_nonce, author_member_id, is_sticky, is_deleted, seq, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: whiteboard_files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whiteboard_files (id, whiteboard_id, file_id, path, mime_type, size, uploaded_by_member_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: whiteboard_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whiteboard_members (id, whiteboard_id, user_id, guest_name, guest_secret_hash, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: whiteboard_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whiteboard_templates (id, workspace_id, name, description, scene, preview, created_by_user_id, created_at, updated_at) FROM stdin;
01a0fdf4-c796-706e-976d-43d796bd5c52	01a0fdf4-c68c-71e9-b847-b63b1938d3c8	Kick-off	\N	{"elements":[],"files":[]}	{"width":0,"height":0,"shapes":[]}	01a0fdf4-c795-7276-916b-1f084312b68e	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Data for Name: whiteboards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whiteboards (id, team_id, title, facilitator_member_id, guest_access_enabled, guest_token, cursors_enabled, seq, purged_seq, created_at, updated_at, reactions_enabled, locked, follow_enabled, timer_ends_at) FROM stdin;
\.


--
-- Data for Name: workspace_invitations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workspace_invitations (id, workspace_id, email, role, token_hash, invited_by_id, expires_at, accepted_at, created_at, updated_at) FROM stdin;
01a0fdf4-c7c5-7048-a736-11ae33bc5c9a	01a0fdf4-c68c-71e9-b847-b63b1938d3c8	Ada@Example.test	member	f10def259f27158f60e0f90a4c61f148ddc963fd7aa28175fbba7ca295534386	\N	2026-10-09 18:51:12	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Data for Name: workspace_template_columns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workspace_template_columns (id, workspace_template_id, title, description, color, "position", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workspace_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workspace_templates (id, workspace_id, name, category, created_by_user_id, created_at, updated_at) FROM stdin;
01a0fdf4-c6ca-71c5-a602-9c05bbc63e24	01a0fdf4-c68c-71e9-b847-b63b1938d3c8	Sprint	essentials	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c6ce-7151-852e-1076b6e094cf	01a0fdf4-c68c-71e9-b847-b63b1938d3c8	Sprint 	essentials	\N	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Data for Name: workspace_user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workspace_user (workspace_id, user_id, role, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workspaces; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workspaces (id, name, slug, created_at, updated_at) FROM stdin;
01a0fdf4-c68c-71e9-b847-b63b1938d3c8	Keeling, Davis and Gusikowski	keeling-davis-and-gusikowski-vlvt0i	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c79f-72bd-8185-9fa16b125ac7	Runte Inc	runte-inc-mbksqz	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a3-71e8-8927-11c87cc4b616	O'Connell-Armstrong	oconnell-armstrong-vlmcng	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a4-7103-9f51-4a6034cfafc0	Herman and Sons	herman-and-sons-3h3mjw	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a4-7103-9f51-4a60376e3a67	Deckow-Goodwin	deckow-goodwin-atgzuw	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a7-735f-b12b-7d6117521774	Kassulke, Morar and Lowe	kassulke-morar-and-lowe-5o040x	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a7-735f-b12b-7d6117a12fd2	Funk, Larkin and Bode	funk-larkin-and-bode-x3pnle	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7a8-72f7-87d2-002f41ff0729	Klein, Bruen and Goodwin	klein-bruen-and-goodwin-jmezug	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7aa-7032-996b-39aa35ad49c3	Hauck, Hessel and Collier	hauck-hessel-and-collier-5vq8ez	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7aa-7032-996b-39aa367327b9	Hermann Inc	hermann-inc-fvl2ix	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7ab-726b-bd47-1338983f1652	Stiedemann, Wolf and O'Reilly	stiedemann-wolf-and-oreilly-dryppk	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7b1-72ec-a188-18c278e44913	Wiza, Welch and Reichel	wiza-welch-and-reichel-nwoml7	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7b5-7001-bb2b-286c729967b0	Wiegand PLC	wiegand-plc-aqfhck	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7b7-7212-ade1-2d310e4f8279	Smith-Leuschke	smith-leuschke-xocnfi	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7bc-7023-a552-953c1970f4ec	Turcotte Group	turcotte-group-gshpdh	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7bf-7390-adf1-501a3465d91a	Vandervort-Hermann	vandervort-hermann-2el9aq	2026-10-02 18:51:12	2026-10-02 18:51:12
01a0fdf4-c7c1-706e-8c44-e398727e42fa	Boyer, Kautzer and Connelly	boyer-kautzer-and-connelly-plmklm	2026-10-02 18:51:12	2026-10-02 18:51:12
\.


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.failed_jobs_id_seq', 1, false);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.jobs_id_seq', 1, false);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 75, true);


--
-- Name: action_item_comments action_item_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_comments
    ADD CONSTRAINT action_item_comments_pkey PRIMARY KEY (id);


--
-- Name: action_item_external_links action_item_external_links_action_item_id_source_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_external_links
    ADD CONSTRAINT action_item_external_links_action_item_id_source_unique UNIQUE (action_item_id, source);


--
-- Name: action_item_external_links action_item_external_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_external_links
    ADD CONSTRAINT action_item_external_links_pkey PRIMARY KEY (id);


--
-- Name: action_item_reminders action_item_reminders_action_item_id_user_id_kind_due_on_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_reminders
    ADD CONSTRAINT action_item_reminders_action_item_id_user_id_kind_due_on_unique UNIQUE (action_item_id, user_id, kind, due_on);


--
-- Name: action_item_reminders action_item_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_reminders
    ADD CONSTRAINT action_item_reminders_pkey PRIMARY KEY (id);


--
-- Name: action_item_subtasks action_item_subtasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_subtasks
    ADD CONSTRAINT action_item_subtasks_pkey PRIMARY KEY (id);


--
-- Name: action_items action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_pkey PRIMARY KEY (id);


--
-- Name: action_items action_items_previous_occurrence_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_previous_occurrence_id_unique UNIQUE (previous_occurrence_id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: card_comments card_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_comments
    ADD CONSTRAINT card_comments_pkey PRIMARY KEY (id);


--
-- Name: card_reactions card_reactions_card_id_participant_id_emoji_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_reactions
    ADD CONSTRAINT card_reactions_card_id_participant_id_emoji_unique UNIQUE (card_id, participant_id, emoji);


--
-- Name: card_reactions card_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_reactions
    ADD CONSTRAINT card_reactions_pkey PRIMARY KEY (id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: columns columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.columns
    ADD CONSTRAINT columns_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: game_gif_answers game_gif_answers_game_round_id_player_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_answers
    ADD CONSTRAINT game_gif_answers_game_round_id_player_id_unique UNIQUE (game_round_id, player_id);


--
-- Name: game_gif_answers game_gif_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_answers
    ADD CONSTRAINT game_gif_answers_pkey PRIMARY KEY (id);


--
-- Name: game_gif_votes game_gif_votes_game_round_id_voter_player_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_votes
    ADD CONSTRAINT game_gif_votes_game_round_id_voter_player_id_unique UNIQUE (game_round_id, voter_player_id);


--
-- Name: game_gif_votes game_gif_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_votes
    ADD CONSTRAINT game_gif_votes_pkey PRIMARY KEY (id);


--
-- Name: game_guesses game_guesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_guesses
    ADD CONSTRAINT game_guesses_pkey PRIMARY KEY (id);


--
-- Name: game_players game_players_game_room_id_participant_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_game_room_id_participant_id_unique UNIQUE (game_room_id, participant_id);


--
-- Name: game_players game_players_game_room_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_game_room_id_user_id_unique UNIQUE (game_room_id, user_id);


--
-- Name: game_players game_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_pkey PRIMARY KEY (id);


--
-- Name: game_points game_points_game_round_id_player_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_game_round_id_player_id_unique UNIQUE (game_round_id, player_id);


--
-- Name: game_points game_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_pkey PRIMARY KEY (id);


--
-- Name: game_rooms game_rooms_guest_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_guest_token_unique UNIQUE (guest_token);


--
-- Name: game_rooms game_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_pkey PRIMARY KEY (id);


--
-- Name: game_rooms game_rooms_retro_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_retro_id_unique UNIQUE (retro_id);


--
-- Name: game_rounds game_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rounds
    ADD CONSTRAINT game_rounds_pkey PRIMARY KEY (id);


--
-- Name: game_used_words game_used_words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_used_words
    ADD CONSTRAINT game_used_words_pkey PRIMARY KEY (team_id, locale, word);


--
-- Name: health_check_answers health_check_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_check_answers
    ADD CONSTRAINT health_check_answers_pkey PRIMARY KEY (id);


--
-- Name: health_check_answers health_check_answers_retro_id_participant_id_statement_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_check_answers
    ADD CONSTRAINT health_check_answers_retro_id_participant_id_statement_unique UNIQUE (retro_id, participant_id, statement);


--
-- Name: instance_settings instance_settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instance_settings
    ADD CONSTRAINT instance_settings_key_unique UNIQUE (key);


--
-- Name: instance_settings instance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instance_settings
    ADD CONSTRAINT instance_settings_pkey PRIMARY KEY (id);


--
-- Name: integration_deliveries integration_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_deliveries
    ADD CONSTRAINT integration_deliveries_pkey PRIMARY KEY (id);


--
-- Name: integration_delivery_payloads integration_delivery_payloads_integration_delivery_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_delivery_payloads
    ADD CONSTRAINT integration_delivery_payloads_integration_delivery_id_unique UNIQUE (integration_delivery_id);


--
-- Name: integration_delivery_payloads integration_delivery_payloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_delivery_payloads
    ADD CONSTRAINT integration_delivery_payloads_pkey PRIMARY KEY (id);


--
-- Name: integration_inbound_events integration_inbound_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_inbound_events
    ADD CONSTRAINT integration_inbound_events_pkey PRIMARY KEY (id);


--
-- Name: integration_inbound_events integration_inbound_events_provider_event_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_inbound_events
    ADD CONSTRAINT integration_inbound_events_provider_event_key_unique UNIQUE (provider, event_key);


--
-- Name: integration_user_mappings integration_user_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_user_mappings
    ADD CONSTRAINT integration_user_mappings_pkey PRIMARY KEY (id);


--
-- Name: integration_user_mappings integration_user_mappings_team_integration_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_user_mappings
    ADD CONSTRAINT integration_user_mappings_team_integration_id_user_id_unique UNIQUE (team_integration_id, user_id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: participants participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_pkey PRIMARY KEY (id);


--
-- Name: participants participants_retro_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_retro_id_user_id_unique UNIQUE (retro_id, user_id);


--
-- Name: passkeys passkeys_credential_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passkeys
    ADD CONSTRAINT passkeys_credential_id_unique UNIQUE (credential_id);


--
-- Name: passkeys passkeys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passkeys
    ADD CONSTRAINT passkeys_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: poker_decks poker_decks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_decks
    ADD CONSTRAINT poker_decks_pkey PRIMARY KEY (id);


--
-- Name: poker_games poker_games_guest_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_games
    ADD CONSTRAINT poker_games_guest_token_unique UNIQUE (guest_token);


--
-- Name: poker_games poker_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_games
    ADD CONSTRAINT poker_games_pkey PRIMARY KEY (id);


--
-- Name: poker_players poker_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_players
    ADD CONSTRAINT poker_players_pkey PRIMARY KEY (id);


--
-- Name: poker_players poker_players_poker_game_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_players
    ADD CONSTRAINT poker_players_poker_game_id_user_id_unique UNIQUE (poker_game_id, user_id);


--
-- Name: poker_rounds poker_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_rounds
    ADD CONSTRAINT poker_rounds_pkey PRIMARY KEY (id);


--
-- Name: poker_rounds poker_rounds_poker_task_id_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_rounds
    ADD CONSTRAINT poker_rounds_poker_task_id_number_unique UNIQUE (poker_task_id, number);


--
-- Name: poker_tasks poker_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_tasks
    ADD CONSTRAINT poker_tasks_pkey PRIMARY KEY (id);


--
-- Name: poker_tasks poker_tasks_poker_game_id_external_source_external_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_tasks
    ADD CONSTRAINT poker_tasks_poker_game_id_external_source_external_id_unique UNIQUE (poker_game_id, external_source, external_id);


--
-- Name: poker_votes poker_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_votes
    ADD CONSTRAINT poker_votes_pkey PRIMARY KEY (id);


--
-- Name: poker_votes poker_votes_poker_round_id_poker_player_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_votes
    ADD CONSTRAINT poker_votes_poker_round_id_poker_player_id_unique UNIQUE (poker_round_id, poker_player_id);


--
-- Name: retro_health_statements retro_health_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_health_statements
    ADD CONSTRAINT retro_health_statements_pkey PRIMARY KEY (id);


--
-- Name: retro_health_statements retro_health_statements_retro_id_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_health_statements
    ADD CONSTRAINT retro_health_statements_retro_id_key_unique UNIQUE (retro_id, key);


--
-- Name: retro_theme_cards retro_theme_cards_card_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_theme_cards
    ADD CONSTRAINT retro_theme_cards_card_id_unique UNIQUE (card_id);


--
-- Name: retro_theme_cards retro_theme_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_theme_cards
    ADD CONSTRAINT retro_theme_cards_pkey PRIMARY KEY (theme_id, card_id);


--
-- Name: retro_themes retro_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_themes
    ADD CONSTRAINT retro_themes_pkey PRIMARY KEY (id);


--
-- Name: retros retros_guest_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retros
    ADD CONSTRAINT retros_guest_token_unique UNIQUE (guest_token);


--
-- Name: retros retros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retros
    ADD CONSTRAINT retros_pkey PRIMARY KEY (id);


--
-- Name: roti_votes roti_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roti_votes
    ADD CONSTRAINT roti_votes_pkey PRIMARY KEY (id);


--
-- Name: roti_votes roti_votes_retro_id_participant_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roti_votes
    ADD CONSTRAINT roti_votes_retro_id_participant_id_unique UNIQUE (retro_id, participant_id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: social_accounts social_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);


--
-- Name: social_accounts social_accounts_provider_provider_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_provider_provider_user_id_unique UNIQUE (provider, provider_user_id);


--
-- Name: suggested_actions suggested_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_actions
    ADD CONSTRAINT suggested_actions_pkey PRIMARY KEY (id);


--
-- Name: survey_comments survey_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_pkey PRIMARY KEY (id);


--
-- Name: survey_options survey_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_options
    ADD CONSTRAINT survey_options_pkey PRIMARY KEY (id);


--
-- Name: survey_reactions survey_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_reactions
    ADD CONSTRAINT survey_reactions_pkey PRIMARY KEY (id);


--
-- Name: survey_reactions survey_reactions_survey_id_participant_id_emoji_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_reactions
    ADD CONSTRAINT survey_reactions_survey_id_participant_id_emoji_unique UNIQUE (survey_id, participant_id, emoji);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_survey_id_participant_id_survey_option_id_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_participant_id_survey_option_id_uniq UNIQUE (survey_id, participant_id, survey_option_id);


--
-- Name: survey_text_answers survey_text_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_text_answers
    ADD CONSTRAINT survey_text_answers_pkey PRIMARY KEY (id);


--
-- Name: survey_text_answers survey_text_answers_survey_id_participant_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_text_answers
    ADD CONSTRAINT survey_text_answers_survey_id_participant_id_unique UNIQUE (survey_id, participant_id);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: team_health_statements team_health_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_health_statements
    ADD CONSTRAINT team_health_statements_pkey PRIMARY KEY (id);


--
-- Name: team_health_statements team_health_statements_team_id_builtin_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_health_statements
    ADD CONSTRAINT team_health_statements_team_id_builtin_unique UNIQUE (team_id, builtin);


--
-- Name: team_integrations team_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_integrations
    ADD CONSTRAINT team_integrations_pkey PRIMARY KEY (id);


--
-- Name: team_integrations team_integrations_team_id_provider_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_integrations
    ADD CONSTRAINT team_integrations_team_id_provider_unique UNIQUE (team_id, provider);


--
-- Name: team_user team_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_user
    ADD CONSTRAINT team_user_pkey PRIMARY KEY (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);


--
-- Name: whiteboard_elements whiteboard_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_elements
    ADD CONSTRAINT whiteboard_elements_pkey PRIMARY KEY (id);


--
-- Name: whiteboard_elements whiteboard_elements_whiteboard_id_element_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_elements
    ADD CONSTRAINT whiteboard_elements_whiteboard_id_element_id_unique UNIQUE (whiteboard_id, element_id);


--
-- Name: whiteboard_files whiteboard_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_files
    ADD CONSTRAINT whiteboard_files_pkey PRIMARY KEY (id);


--
-- Name: whiteboard_files whiteboard_files_whiteboard_id_file_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_files
    ADD CONSTRAINT whiteboard_files_whiteboard_id_file_id_unique UNIQUE (whiteboard_id, file_id);


--
-- Name: whiteboard_members whiteboard_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_members
    ADD CONSTRAINT whiteboard_members_pkey PRIMARY KEY (id);


--
-- Name: whiteboard_members whiteboard_members_whiteboard_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_members
    ADD CONSTRAINT whiteboard_members_whiteboard_id_user_id_unique UNIQUE (whiteboard_id, user_id);


--
-- Name: whiteboard_templates whiteboard_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_templates
    ADD CONSTRAINT whiteboard_templates_pkey PRIMARY KEY (id);


--
-- Name: whiteboards whiteboards_guest_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboards
    ADD CONSTRAINT whiteboards_guest_token_unique UNIQUE (guest_token);


--
-- Name: whiteboards whiteboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboards
    ADD CONSTRAINT whiteboards_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_token_hash_unique UNIQUE (token_hash);


--
-- Name: workspace_template_columns workspace_template_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_template_columns
    ADD CONSTRAINT workspace_template_columns_pkey PRIMARY KEY (id);


--
-- Name: workspace_templates workspace_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_templates
    ADD CONSTRAINT workspace_templates_pkey PRIMARY KEY (id);


--
-- Name: workspace_user workspace_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT workspace_user_pkey PRIMARY KEY (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_unique UNIQUE (slug);


--
-- Name: action_item_comments_action_item_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_item_comments_action_item_id_created_at_index ON public.action_item_comments USING btree (action_item_id, created_at);


--
-- Name: action_item_external_links_source_external_site_external_id_ind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_item_external_links_source_external_site_external_id_ind ON public.action_item_external_links USING btree (source, external_site, external_id);


--
-- Name: action_item_reminders_sent_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_item_reminders_sent_at_index ON public.action_item_reminders USING btree (sent_at);


--
-- Name: action_item_subtasks_action_item_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_item_subtasks_action_item_id_position_index ON public.action_item_subtasks USING btree (action_item_id, "position");


--
-- Name: action_items_assignee_user_id_completed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_assignee_user_id_completed_at_index ON public.action_items USING btree (assignee_user_id, completed_at);


--
-- Name: action_items_completed_at_due_on_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_completed_at_due_on_index ON public.action_items USING btree (completed_at, due_on);


--
-- Name: action_items_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_retro_id_index ON public.action_items USING btree (retro_id);


--
-- Name: action_items_team_id_completed_at_due_on_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_items_team_id_completed_at_due_on_index ON public.action_items USING btree (team_id, completed_at, due_on);


--
-- Name: cache_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);


--
-- Name: cache_locks_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);


--
-- Name: card_comments_card_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX card_comments_card_id_created_at_index ON public.card_comments USING btree (card_id, created_at);


--
-- Name: card_comments_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX card_comments_retro_id_index ON public.card_comments USING btree (retro_id);


--
-- Name: card_reactions_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX card_reactions_retro_id_index ON public.card_reactions USING btree (retro_id);


--
-- Name: cards_column_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cards_column_id_position_index ON public.cards USING btree (column_id, "position");


--
-- Name: cards_participant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cards_participant_id_index ON public.cards USING btree (participant_id);


--
-- Name: cards_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cards_retro_id_index ON public.cards USING btree (retro_id);


--
-- Name: columns_retro_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX columns_retro_id_position_index ON public.columns USING btree (retro_id, "position");


--
-- Name: failed_jobs_connection_queue_failed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX failed_jobs_connection_queue_failed_at_index ON public.failed_jobs USING btree (connection, queue, failed_at);


--
-- Name: game_guesses_game_round_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_guesses_game_round_id_created_at_index ON public.game_guesses USING btree (game_round_id, created_at);


--
-- Name: game_points_game_room_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_points_game_room_id_created_at_index ON public.game_points USING btree (game_room_id, created_at);


--
-- Name: game_points_team_id_user_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_points_team_id_user_id_created_at_index ON public.game_points USING btree (team_id, user_id, created_at);


--
-- Name: game_rooms_team_id_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_rooms_team_id_retro_id_index ON public.game_rooms USING btree (team_id, retro_id);


--
-- Name: game_rounds_game_room_id_ended_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_rounds_game_room_id_ended_at_index ON public.game_rounds USING btree (game_room_id, ended_at);


--
-- Name: health_check_answers_retro_id_statement_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX health_check_answers_retro_id_statement_index ON public.health_check_answers USING btree (retro_id, statement);


--
-- Name: integration_deliveries_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_deliveries_created_at_index ON public.integration_deliveries USING btree (created_at);


--
-- Name: integration_deliveries_redelivery_of_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_deliveries_redelivery_of_id_index ON public.integration_deliveries USING btree (redelivery_of_id);


--
-- Name: integration_deliveries_subject_type_subject_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_deliveries_subject_type_subject_id_index ON public.integration_deliveries USING btree (subject_type, subject_id);


--
-- Name: integration_delivery_payloads_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_delivery_payloads_created_at_index ON public.integration_delivery_payloads USING btree (created_at);


--
-- Name: integration_inbound_events_received_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_inbound_events_received_at_index ON public.integration_inbound_events USING btree (received_at);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: notifications_notifiable_type_notifiable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_notifiable_type_notifiable_id_index ON public.notifications USING btree (notifiable_type, notifiable_id);


--
-- Name: notifications_notifiable_type_notifiable_id_read_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_notifiable_type_notifiable_id_read_at_index ON public.notifications USING btree (notifiable_type, notifiable_id, read_at);


--
-- Name: passkeys_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX passkeys_user_id_index ON public.passkeys USING btree (user_id);


--
-- Name: personal_access_tokens_expires_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: poker_decks_team_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poker_decks_team_id_index ON public.poker_decks USING btree (team_id);


--
-- Name: poker_decks_team_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX poker_decks_team_name_unique ON public.poker_decks USING btree (team_id, lower((name)::text));


--
-- Name: poker_decks_workspace_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX poker_decks_workspace_name_unique ON public.poker_decks USING btree (workspace_id, lower((name)::text)) WHERE (workspace_id IS NOT NULL);


--
-- Name: poker_games_team_id_ended_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poker_games_team_id_ended_at_index ON public.poker_games USING btree (team_id, ended_at);


--
-- Name: poker_tasks_external_source_external_site_external_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poker_tasks_external_source_external_site_external_id_index ON public.poker_tasks USING btree (external_source, external_site, external_id);


--
-- Name: poker_tasks_poker_game_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poker_tasks_poker_game_id_position_index ON public.poker_tasks USING btree (poker_game_id, "position");


--
-- Name: retros_team_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retros_team_id_created_at_index ON public.retros USING btree (team_id, created_at);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: suggested_actions_retro_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suggested_actions_retro_id_status_index ON public.suggested_actions USING btree (retro_id, status);


--
-- Name: survey_comments_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_comments_retro_id_index ON public.survey_comments USING btree (retro_id);


--
-- Name: survey_comments_survey_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_comments_survey_id_created_at_index ON public.survey_comments USING btree (survey_id, created_at);


--
-- Name: survey_options_survey_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_options_survey_id_position_index ON public.survey_options USING btree (survey_id, "position");


--
-- Name: survey_reactions_retro_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX survey_reactions_retro_id_index ON public.survey_reactions USING btree (retro_id);


--
-- Name: surveys_retro_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX surveys_retro_id_position_index ON public.surveys USING btree (retro_id, "position");


--
-- Name: team_integrations_provider_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_integrations_provider_status_index ON public.team_integrations USING btree (provider, status);


--
-- Name: votes_card_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX votes_card_id_index ON public.votes USING btree (card_id);


--
-- Name: votes_retro_id_participant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX votes_retro_id_participant_id_index ON public.votes USING btree (retro_id, participant_id);


--
-- Name: whiteboard_elements_whiteboard_id_seq_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whiteboard_elements_whiteboard_id_seq_index ON public.whiteboard_elements USING btree (whiteboard_id, seq);


--
-- Name: whiteboard_templates_workspace_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whiteboard_templates_workspace_id_index ON public.whiteboard_templates USING btree (workspace_id);


--
-- Name: whiteboard_templates_workspace_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX whiteboard_templates_workspace_name_unique ON public.whiteboard_templates USING btree (workspace_id, lower((name)::text));


--
-- Name: whiteboards_team_id_updated_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whiteboards_team_id_updated_at_index ON public.whiteboards USING btree (team_id, updated_at);


--
-- Name: workspace_invitations_workspace_id_email_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_invitations_workspace_id_email_index ON public.workspace_invitations USING btree (workspace_id, email);


--
-- Name: workspace_template_columns_workspace_template_id_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_template_columns_workspace_template_id_position_index ON public.workspace_template_columns USING btree (workspace_template_id, "position");


--
-- Name: workspace_templates_workspace_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workspace_templates_workspace_name_unique ON public.workspace_templates USING btree (workspace_id, lower((name)::text));


--
-- Name: action_item_comments action_item_comments_action_item_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_comments
    ADD CONSTRAINT action_item_comments_action_item_id_foreign FOREIGN KEY (action_item_id) REFERENCES public.action_items(id) ON DELETE CASCADE;


--
-- Name: action_item_comments action_item_comments_author_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_comments
    ADD CONSTRAINT action_item_comments_author_participant_id_foreign FOREIGN KEY (author_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: action_item_comments action_item_comments_author_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_comments
    ADD CONSTRAINT action_item_comments_author_user_id_foreign FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_item_external_links action_item_external_links_action_item_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_external_links
    ADD CONSTRAINT action_item_external_links_action_item_id_foreign FOREIGN KEY (action_item_id) REFERENCES public.action_items(id) ON DELETE CASCADE;


--
-- Name: action_item_external_links action_item_external_links_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_external_links
    ADD CONSTRAINT action_item_external_links_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_item_reminders action_item_reminders_action_item_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_reminders
    ADD CONSTRAINT action_item_reminders_action_item_id_foreign FOREIGN KEY (action_item_id) REFERENCES public.action_items(id) ON DELETE CASCADE;


--
-- Name: action_item_reminders action_item_reminders_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_reminders
    ADD CONSTRAINT action_item_reminders_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: action_item_subtasks action_item_subtasks_action_item_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_item_subtasks
    ADD CONSTRAINT action_item_subtasks_action_item_id_foreign FOREIGN KEY (action_item_id) REFERENCES public.action_items(id) ON DELETE CASCADE;


--
-- Name: action_items action_items_assignee_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_assignee_participant_id_foreign FOREIGN KEY (assignee_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: action_items action_items_assignee_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_assignee_user_id_foreign FOREIGN KEY (assignee_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_items action_items_created_by_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_created_by_participant_id_foreign FOREIGN KEY (created_by_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: action_items action_items_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: action_items action_items_previous_occurrence_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_previous_occurrence_id_foreign FOREIGN KEY (previous_occurrence_id) REFERENCES public.action_items(id) ON DELETE SET NULL;


--
-- Name: action_items action_items_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: action_items action_items_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: action_items action_items_theme_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_theme_id_foreign FOREIGN KEY (theme_id) REFERENCES public.retro_themes(id) ON DELETE SET NULL;


--
-- Name: card_comments card_comments_card_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_comments
    ADD CONSTRAINT card_comments_card_id_foreign FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: card_comments card_comments_parent_comment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_comments
    ADD CONSTRAINT card_comments_parent_comment_id_foreign FOREIGN KEY (parent_comment_id) REFERENCES public.card_comments(id) ON DELETE CASCADE;


--
-- Name: card_comments card_comments_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_comments
    ADD CONSTRAINT card_comments_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: card_comments card_comments_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_comments
    ADD CONSTRAINT card_comments_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: card_reactions card_reactions_card_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_reactions
    ADD CONSTRAINT card_reactions_card_id_foreign FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: card_reactions card_reactions_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_reactions
    ADD CONSTRAINT card_reactions_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: card_reactions card_reactions_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_reactions
    ADD CONSTRAINT card_reactions_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: cards cards_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_column_id_foreign FOREIGN KEY (column_id) REFERENCES public.columns(id) ON DELETE CASCADE;


--
-- Name: cards cards_parent_card_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_parent_card_id_foreign FOREIGN KEY (parent_card_id) REFERENCES public.cards(id) ON DELETE SET NULL;


--
-- Name: cards cards_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: cards cards_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: columns columns_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.columns
    ADD CONSTRAINT columns_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: game_gif_answers game_gif_answers_game_round_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_answers
    ADD CONSTRAINT game_gif_answers_game_round_id_foreign FOREIGN KEY (game_round_id) REFERENCES public.game_rounds(id) ON DELETE CASCADE;


--
-- Name: game_gif_answers game_gif_answers_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_answers
    ADD CONSTRAINT game_gif_answers_player_id_foreign FOREIGN KEY (player_id) REFERENCES public.game_players(id) ON DELETE CASCADE;


--
-- Name: game_gif_votes game_gif_votes_answer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_votes
    ADD CONSTRAINT game_gif_votes_answer_id_foreign FOREIGN KEY (answer_id) REFERENCES public.game_gif_answers(id) ON DELETE CASCADE;


--
-- Name: game_gif_votes game_gif_votes_game_round_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_votes
    ADD CONSTRAINT game_gif_votes_game_round_id_foreign FOREIGN KEY (game_round_id) REFERENCES public.game_rounds(id) ON DELETE CASCADE;


--
-- Name: game_gif_votes game_gif_votes_voter_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_gif_votes
    ADD CONSTRAINT game_gif_votes_voter_player_id_foreign FOREIGN KEY (voter_player_id) REFERENCES public.game_players(id) ON DELETE CASCADE;


--
-- Name: game_guesses game_guesses_game_round_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_guesses
    ADD CONSTRAINT game_guesses_game_round_id_foreign FOREIGN KEY (game_round_id) REFERENCES public.game_rounds(id) ON DELETE CASCADE;


--
-- Name: game_guesses game_guesses_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_guesses
    ADD CONSTRAINT game_guesses_player_id_foreign FOREIGN KEY (player_id) REFERENCES public.game_players(id) ON DELETE CASCADE;


--
-- Name: game_players game_players_game_room_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_game_room_id_foreign FOREIGN KEY (game_room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;


--
-- Name: game_players game_players_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: game_players game_players_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: game_points game_points_game_room_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_game_room_id_foreign FOREIGN KEY (game_room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;


--
-- Name: game_points game_points_game_round_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_game_round_id_foreign FOREIGN KEY (game_round_id) REFERENCES public.game_rounds(id) ON DELETE SET NULL;


--
-- Name: game_points game_points_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_player_id_foreign FOREIGN KEY (player_id) REFERENCES public.game_players(id) ON DELETE CASCADE;


--
-- Name: game_points game_points_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: game_points game_points_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_points
    ADD CONSTRAINT game_points_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: game_rooms game_rooms_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: game_rooms game_rooms_current_round_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_current_round_id_foreign FOREIGN KEY (current_round_id) REFERENCES public.game_rounds(id) ON DELETE SET NULL;


--
-- Name: game_rooms game_rooms_host_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_host_player_id_foreign FOREIGN KEY (host_player_id) REFERENCES public.game_players(id) ON DELETE SET NULL;


--
-- Name: game_rooms game_rooms_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: game_rooms game_rooms_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rooms
    ADD CONSTRAINT game_rooms_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: game_rounds game_rounds_game_room_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rounds
    ADD CONSTRAINT game_rounds_game_room_id_foreign FOREIGN KEY (game_room_id) REFERENCES public.game_rooms(id) ON DELETE CASCADE;


--
-- Name: game_rounds game_rounds_leader_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rounds
    ADD CONSTRAINT game_rounds_leader_player_id_foreign FOREIGN KEY (leader_player_id) REFERENCES public.game_players(id) ON DELETE SET NULL;


--
-- Name: game_rounds game_rounds_winner_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rounds
    ADD CONSTRAINT game_rounds_winner_player_id_foreign FOREIGN KEY (winner_player_id) REFERENCES public.game_players(id) ON DELETE SET NULL;


--
-- Name: game_used_words game_used_words_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_used_words
    ADD CONSTRAINT game_used_words_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: health_check_answers health_check_answers_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_check_answers
    ADD CONSTRAINT health_check_answers_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: health_check_answers health_check_answers_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_check_answers
    ADD CONSTRAINT health_check_answers_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: integration_deliveries integration_deliveries_redelivery_of_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_deliveries
    ADD CONSTRAINT integration_deliveries_redelivery_of_id_foreign FOREIGN KEY (redelivery_of_id) REFERENCES public.integration_deliveries(id) ON DELETE SET NULL;


--
-- Name: integration_deliveries integration_deliveries_requested_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_deliveries
    ADD CONSTRAINT integration_deliveries_requested_by_user_id_foreign FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: integration_deliveries integration_deliveries_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_deliveries
    ADD CONSTRAINT integration_deliveries_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: integration_deliveries integration_deliveries_team_integration_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_deliveries
    ADD CONSTRAINT integration_deliveries_team_integration_id_foreign FOREIGN KEY (team_integration_id) REFERENCES public.team_integrations(id) ON DELETE SET NULL;


--
-- Name: integration_delivery_payloads integration_delivery_payloads_integration_delivery_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_delivery_payloads
    ADD CONSTRAINT integration_delivery_payloads_integration_delivery_id_foreign FOREIGN KEY (integration_delivery_id) REFERENCES public.integration_deliveries(id) ON DELETE CASCADE;


--
-- Name: integration_inbound_events integration_inbound_events_team_integration_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_inbound_events
    ADD CONSTRAINT integration_inbound_events_team_integration_id_foreign FOREIGN KEY (team_integration_id) REFERENCES public.team_integrations(id) ON DELETE SET NULL;


--
-- Name: integration_user_mappings integration_user_mappings_team_integration_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_user_mappings
    ADD CONSTRAINT integration_user_mappings_team_integration_id_foreign FOREIGN KEY (team_integration_id) REFERENCES public.team_integrations(id) ON DELETE CASCADE;


--
-- Name: integration_user_mappings integration_user_mappings_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_user_mappings
    ADD CONSTRAINT integration_user_mappings_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: participants participants_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: participants participants_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participants
    ADD CONSTRAINT participants_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: passkeys passkeys_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passkeys
    ADD CONSTRAINT passkeys_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: personal_access_tokens personal_access_tokens_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: poker_decks poker_decks_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_decks
    ADD CONSTRAINT poker_decks_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: poker_decks poker_decks_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_decks
    ADD CONSTRAINT poker_decks_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: poker_decks poker_decks_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_decks
    ADD CONSTRAINT poker_decks_workspace_id_foreign FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: poker_games poker_games_current_task_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_games
    ADD CONSTRAINT poker_games_current_task_id_foreign FOREIGN KEY (current_task_id) REFERENCES public.poker_tasks(id) ON DELETE SET NULL;


--
-- Name: poker_games poker_games_facilitator_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_games
    ADD CONSTRAINT poker_games_facilitator_player_id_foreign FOREIGN KEY (facilitator_player_id) REFERENCES public.poker_players(id) ON DELETE SET NULL;


--
-- Name: poker_games poker_games_saved_deck_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_games
    ADD CONSTRAINT poker_games_saved_deck_id_foreign FOREIGN KEY (saved_deck_id) REFERENCES public.poker_decks(id) ON DELETE SET NULL;


--
-- Name: poker_games poker_games_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_games
    ADD CONSTRAINT poker_games_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: poker_players poker_players_poker_game_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_players
    ADD CONSTRAINT poker_players_poker_game_id_foreign FOREIGN KEY (poker_game_id) REFERENCES public.poker_games(id) ON DELETE CASCADE;


--
-- Name: poker_players poker_players_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_players
    ADD CONSTRAINT poker_players_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: poker_rounds poker_rounds_poker_task_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_rounds
    ADD CONSTRAINT poker_rounds_poker_task_id_foreign FOREIGN KEY (poker_task_id) REFERENCES public.poker_tasks(id) ON DELETE CASCADE;


--
-- Name: poker_tasks poker_tasks_poker_game_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_tasks
    ADD CONSTRAINT poker_tasks_poker_game_id_foreign FOREIGN KEY (poker_game_id) REFERENCES public.poker_games(id) ON DELETE CASCADE;


--
-- Name: poker_votes poker_votes_poker_player_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_votes
    ADD CONSTRAINT poker_votes_poker_player_id_foreign FOREIGN KEY (poker_player_id) REFERENCES public.poker_players(id) ON DELETE CASCADE;


--
-- Name: poker_votes poker_votes_poker_round_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.poker_votes
    ADD CONSTRAINT poker_votes_poker_round_id_foreign FOREIGN KEY (poker_round_id) REFERENCES public.poker_rounds(id) ON DELETE CASCADE;


--
-- Name: retro_health_statements retro_health_statements_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_health_statements
    ADD CONSTRAINT retro_health_statements_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: retro_health_statements retro_health_statements_team_health_statement_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_health_statements
    ADD CONSTRAINT retro_health_statements_team_health_statement_id_foreign FOREIGN KEY (team_health_statement_id) REFERENCES public.team_health_statements(id) ON DELETE SET NULL;


--
-- Name: retro_theme_cards retro_theme_cards_card_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_theme_cards
    ADD CONSTRAINT retro_theme_cards_card_id_foreign FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: retro_theme_cards retro_theme_cards_theme_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_theme_cards
    ADD CONSTRAINT retro_theme_cards_theme_id_foreign FOREIGN KEY (theme_id) REFERENCES public.retro_themes(id) ON DELETE CASCADE;


--
-- Name: retro_themes retro_themes_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retro_themes
    ADD CONSTRAINT retro_themes_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: retros retros_facilitator_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retros
    ADD CONSTRAINT retros_facilitator_participant_id_foreign FOREIGN KEY (facilitator_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: retros retros_highlighted_card_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retros
    ADD CONSTRAINT retros_highlighted_card_id_foreign FOREIGN KEY (highlighted_card_id) REFERENCES public.cards(id) ON DELETE SET NULL;


--
-- Name: retros retros_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retros
    ADD CONSTRAINT retros_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: retros retros_workspace_template_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retros
    ADD CONSTRAINT retros_workspace_template_id_foreign FOREIGN KEY (workspace_template_id) REFERENCES public.workspace_templates(id) ON DELETE SET NULL;


--
-- Name: roti_votes roti_votes_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roti_votes
    ADD CONSTRAINT roti_votes_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: roti_votes roti_votes_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roti_votes
    ADD CONSTRAINT roti_votes_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: social_accounts social_accounts_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: suggested_actions suggested_actions_action_item_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_actions
    ADD CONSTRAINT suggested_actions_action_item_id_foreign FOREIGN KEY (action_item_id) REFERENCES public.action_items(id) ON DELETE SET NULL;


--
-- Name: suggested_actions suggested_actions_handled_by_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_actions
    ADD CONSTRAINT suggested_actions_handled_by_participant_id_foreign FOREIGN KEY (handled_by_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: suggested_actions suggested_actions_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_actions
    ADD CONSTRAINT suggested_actions_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: suggested_actions suggested_actions_theme_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suggested_actions
    ADD CONSTRAINT suggested_actions_theme_id_foreign FOREIGN KEY (theme_id) REFERENCES public.retro_themes(id) ON DELETE SET NULL;


--
-- Name: survey_comments survey_comments_parent_comment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_parent_comment_id_foreign FOREIGN KEY (parent_comment_id) REFERENCES public.survey_comments(id) ON DELETE CASCADE;


--
-- Name: survey_comments survey_comments_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: survey_comments survey_comments_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: survey_comments survey_comments_survey_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_comments
    ADD CONSTRAINT survey_comments_survey_id_foreign FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_options survey_options_survey_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_options
    ADD CONSTRAINT survey_options_survey_id_foreign FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_reactions survey_reactions_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_reactions
    ADD CONSTRAINT survey_reactions_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: survey_reactions survey_reactions_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_reactions
    ADD CONSTRAINT survey_reactions_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: survey_reactions survey_reactions_survey_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_reactions
    ADD CONSTRAINT survey_reactions_survey_id_foreign FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_survey_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_foreign FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_survey_option_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_option_id_foreign FOREIGN KEY (survey_option_id) REFERENCES public.survey_options(id) ON DELETE CASCADE;


--
-- Name: survey_text_answers survey_text_answers_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_text_answers
    ADD CONSTRAINT survey_text_answers_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: survey_text_answers survey_text_answers_survey_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_text_answers
    ADD CONSTRAINT survey_text_answers_survey_id_foreign FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: surveys surveys_created_by_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_created_by_participant_id_foreign FOREIGN KEY (created_by_participant_id) REFERENCES public.participants(id) ON DELETE SET NULL;


--
-- Name: surveys surveys_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: team_health_statements team_health_statements_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_health_statements
    ADD CONSTRAINT team_health_statements_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_integrations team_integrations_connected_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_integrations
    ADD CONSTRAINT team_integrations_connected_by_user_id_foreign FOREIGN KEY (connected_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: team_integrations team_integrations_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_integrations
    ADD CONSTRAINT team_integrations_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_user team_user_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_user
    ADD CONSTRAINT team_user_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_user team_user_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_user
    ADD CONSTRAINT team_user_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_default_saved_poker_deck_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_default_saved_poker_deck_id_foreign FOREIGN KEY (default_saved_poker_deck_id) REFERENCES public.poker_decks(id) ON DELETE SET NULL;


--
-- Name: teams teams_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_workspace_id_foreign FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: users users_current_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_current_workspace_id_foreign FOREIGN KEY (current_workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: votes votes_card_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_card_id_foreign FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: votes votes_participant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_participant_id_foreign FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE;


--
-- Name: votes votes_retro_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_retro_id_foreign FOREIGN KEY (retro_id) REFERENCES public.retros(id) ON DELETE CASCADE;


--
-- Name: whiteboard_elements whiteboard_elements_author_member_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_elements
    ADD CONSTRAINT whiteboard_elements_author_member_id_foreign FOREIGN KEY (author_member_id) REFERENCES public.whiteboard_members(id) ON DELETE SET NULL;


--
-- Name: whiteboard_elements whiteboard_elements_whiteboard_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_elements
    ADD CONSTRAINT whiteboard_elements_whiteboard_id_foreign FOREIGN KEY (whiteboard_id) REFERENCES public.whiteboards(id) ON DELETE CASCADE;


--
-- Name: whiteboard_files whiteboard_files_uploaded_by_member_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_files
    ADD CONSTRAINT whiteboard_files_uploaded_by_member_id_foreign FOREIGN KEY (uploaded_by_member_id) REFERENCES public.whiteboard_members(id) ON DELETE SET NULL;


--
-- Name: whiteboard_files whiteboard_files_whiteboard_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_files
    ADD CONSTRAINT whiteboard_files_whiteboard_id_foreign FOREIGN KEY (whiteboard_id) REFERENCES public.whiteboards(id) ON DELETE CASCADE;


--
-- Name: whiteboard_members whiteboard_members_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_members
    ADD CONSTRAINT whiteboard_members_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: whiteboard_members whiteboard_members_whiteboard_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_members
    ADD CONSTRAINT whiteboard_members_whiteboard_id_foreign FOREIGN KEY (whiteboard_id) REFERENCES public.whiteboards(id) ON DELETE CASCADE;


--
-- Name: whiteboard_templates whiteboard_templates_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_templates
    ADD CONSTRAINT whiteboard_templates_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: whiteboard_templates whiteboard_templates_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboard_templates
    ADD CONSTRAINT whiteboard_templates_workspace_id_foreign FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: whiteboards whiteboards_facilitator_member_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboards
    ADD CONSTRAINT whiteboards_facilitator_member_id_foreign FOREIGN KEY (facilitator_member_id) REFERENCES public.whiteboard_members(id) ON DELETE SET NULL;


--
-- Name: whiteboards whiteboards_team_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whiteboards
    ADD CONSTRAINT whiteboards_team_id_foreign FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_invited_by_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_id_foreign FOREIGN KEY (invited_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workspace_invitations workspace_invitations_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_foreign FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_template_columns workspace_template_columns_workspace_template_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_template_columns
    ADD CONSTRAINT workspace_template_columns_workspace_template_id_foreign FOREIGN KEY (workspace_template_id) REFERENCES public.workspace_templates(id) ON DELETE CASCADE;


--
-- Name: workspace_templates workspace_templates_created_by_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_templates
    ADD CONSTRAINT workspace_templates_created_by_user_id_foreign FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workspace_templates workspace_templates_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_templates
    ADD CONSTRAINT workspace_templates_workspace_id_foreign FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_user workspace_user_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT workspace_user_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_user workspace_user_workspace_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_user
    ADD CONSTRAINT workspace_user_workspace_id_foreign FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 1t1dTPXi6Ruo0ixLVValF3AEQSIGGJszseJg1JffE6WwakWk3ej6HPUh092Oio8

