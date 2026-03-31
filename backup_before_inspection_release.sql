--
-- PostgreSQL database dump
--

\restrict AohRdgL2J02UG9g3tJq8CDuFUDeXRN4KV8FaoFiUYkzNmDbO9GJMcuQbumpsMwN

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

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
-- Name: CompanyType; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."CompanyType" AS ENUM (
    'CLIENT',
    'PROVIDER'
);


ALTER TYPE public."CompanyType" OWNER TO sma_user;

--
-- Name: PublicRequestType; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."PublicRequestType" AS ENUM (
    'REPAIR',
    'NOTE'
);


ALTER TYPE public."PublicRequestType" OWNER TO sma_user;

--
-- Name: ServiceContractRole; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."ServiceContractRole" AS ENUM (
    'PRIMARY',
    'SECONDARY'
);


ALTER TYPE public."ServiceContractRole" OWNER TO sma_user;

--
-- Name: ServiceContractStatus; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."ServiceContractStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'INACTIVE',
    'ENDED'
);


ALTER TYPE public."ServiceContractStatus" OWNER TO sma_user;

--
-- Name: TicketSource; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."TicketSource" AS ENUM (
    'INTERNAL',
    'PUBLIC_QUICK_REQUEST'
);


ALTER TYPE public."TicketSource" OWNER TO sma_user;

--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'NEW',
    'ASSIGNED',
    'IN_PROGRESS',
    'DONE',
    'CANCELED'
);


ALTER TYPE public."TicketStatus" OWNER TO sma_user;

--
-- Name: TicketUrgency; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."TicketUrgency" AS ENUM (
    'URGENT',
    'NOT_URGENT'
);


ALTER TYPE public."TicketUrgency" OWNER TO sma_user;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: sma_user
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'DISPATCHER',
    'TECHNICIAN',
    'CLIENT',
    'NETWORK_DIRECTOR',
    'STAFF',
    'MASTER',
    'TERRITORIAL_MANAGER',
    'PLATFORM_ADMIN'
);


ALTER TYPE public."UserRole" OWNER TO sma_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AssignmentCursor; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."AssignmentCursor" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    strategy text NOT NULL,
    cursor integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AssignmentCursor" OWNER TO sma_user;

--
-- Name: Company; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."Company" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "autoAssignEnabled" boolean DEFAULT true NOT NULL,
    type public."CompanyType" DEFAULT 'CLIENT'::public."CompanyType" NOT NULL,
    "allowTechnicianClaim" boolean DEFAULT true NOT NULL,
    "slaStrictMode" boolean DEFAULT false NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "publicRequestEnabled" boolean DEFAULT false NOT NULL,
    "publicRequestToken" text,
    "publicRequestIntro" text,
    "publicRequestAllowPhotos" boolean DEFAULT true NOT NULL,
    "publicRequestMaxPhotos" integer DEFAULT 3 NOT NULL,
    "publicRequestRequirePhone" boolean DEFAULT true NOT NULL,
    "publicRequestDefaultType" public."PublicRequestType",
    "publicRequestRateLimitEnabled" boolean DEFAULT true NOT NULL,
    "publicRequestLocationPresetMode" text DEFAULT 'HIDE_WHEN_VALID'::text
);


ALTER TABLE public."Company" OWNER TO sma_user;

--
-- Name: DomainEvent; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."DomainEvent" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    type text NOT NULL,
    "actorUserId" text,
    payload jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DomainEvent" OWNER TO sma_user;

--
-- Name: Equipment; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."Equipment" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "locationId" text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Equipment" OWNER TO sma_user;

--
-- Name: Location; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."Location" (
    id text NOT NULL,
    "clientCompanyId" text NOT NULL,
    name text NOT NULL,
    "platformCode" text NOT NULL,
    "externalCode" text,
    city text,
    region text,
    address text,
    latitude double precision,
    longitude double precision,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Location" OWNER TO sma_user;

--
-- Name: PermissionBlock; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."PermissionBlock" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PermissionBlock" OWNER TO sma_user;

--
-- Name: ProblemCategory; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."ProblemCategory" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    instructions text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProblemCategory" OWNER TO sma_user;

--
-- Name: ProblemCategorySpecialization; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."ProblemCategorySpecialization" (
    "problemCategoryId" text NOT NULL,
    "specializationId" text NOT NULL
);


ALTER TABLE public."ProblemCategorySpecialization" OWNER TO sma_user;

--
-- Name: PublicRequestLog; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."PublicRequestLog" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "ipHash" text,
    "phoneHash" text,
    "locationId" text,
    channel text,
    action text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PublicRequestLog" OWNER TO sma_user;

--
-- Name: RolePermission; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."RolePermission" (
    id text NOT NULL,
    role public."UserRole" NOT NULL,
    "permissionBlockId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RolePermission" OWNER TO sma_user;

--
-- Name: ServiceContract; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."ServiceContract" (
    id text NOT NULL,
    "clientCompanyId" text NOT NULL,
    "providerCompanyId" text NOT NULL,
    status public."ServiceContractStatus" DEFAULT 'DRAFT'::public."ServiceContractStatus" NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role public."ServiceContractRole" DEFAULT 'PRIMARY'::public."ServiceContractRole" NOT NULL
);


ALTER TABLE public."ServiceContract" OWNER TO sma_user;

--
-- Name: Specialization; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."Specialization" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Specialization" OWNER TO sma_user;

--
-- Name: TechnicianSpecialization; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."TechnicianSpecialization" (
    "userId" text NOT NULL,
    "specializationId" text NOT NULL
);


ALTER TABLE public."TechnicianSpecialization" OWNER TO sma_user;

--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."Ticket" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "parentId" text,
    "requesterName" text,
    "requesterPhone" text,
    address text,
    "pointName" text,
    "problemCategoryId" text NOT NULL,
    "problemText" text NOT NULL,
    urgency public."TicketUrgency" DEFAULT 'NOT_URGENT'::public."TicketUrgency" NOT NULL,
    status public."TicketStatus" DEFAULT 'NEW'::public."TicketStatus" NOT NULL,
    "slaMinutes" integer,
    "assignedTechnicianId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "statusUpdatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "slaBreachedAt" timestamp(3) without time zone,
    "slaDueAt" timestamp(3) without time zone,
    "locationId" text NOT NULL,
    "equipmentId" text,
    source public."TicketSource" DEFAULT 'INTERNAL'::public."TicketSource" NOT NULL,
    "publicRequestType" public."PublicRequestType"
);


ALTER TABLE public."Ticket" OWNER TO sma_user;

--
-- Name: TicketAttachment; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."TicketAttachment" (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "ticketId" text,
    "uploadedByUserId" text,
    "originalName" text NOT NULL,
    "storageKey" text NOT NULL,
    "mimeType" text NOT NULL,
    "sizeBytes" integer NOT NULL,
    url text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TicketAttachment" OWNER TO sma_user;

--
-- Name: TicketStatusHistory; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."TicketStatusHistory" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "fromStatus" public."TicketStatus",
    "toStatus" public."TicketStatus" NOT NULL,
    comment text,
    "changedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TicketStatusHistory" OWNER TO sma_user;

--
-- Name: User; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "companyId" text NOT NULL,
    role public."UserRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "firstName" text,
    "lastName" text,
    "profilePhotoUrl" text
);


ALTER TABLE public."User" OWNER TO sma_user;

--
-- Name: UserPermission; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public."UserPermission" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "permissionBlockId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."UserPermission" OWNER TO sma_user;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: sma_user
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO sma_user;

--
-- Data for Name: AssignmentCursor; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."AssignmentCursor" (id, "companyId", strategy, cursor, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Company; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."Company" (id, name, "createdAt", "autoAssignEnabled", type, "allowTechnicianClaim", "slaStrictMode", timezone, "updatedAt", "publicRequestEnabled", "publicRequestToken", "publicRequestIntro", "publicRequestAllowPhotos", "publicRequestMaxPhotos", "publicRequestRequirePhone", "publicRequestDefaultType", "publicRequestRateLimitEnabled", "publicRequestLocationPresetMode") FROM stdin;
88b45fe1-fac9-4b76-a2fb-4f1d640f9172	ServiceManager Platform	2026-03-27 10:29:27.123	t	PROVIDER	t	f	UTC	2026-03-27 10:29:27.123	f	\N	\N	t	3	t	\N	t	HIDE_WHEN_VALID
e453953f-f360-48ad-9dd5-4a673f09a94b	Фудзияма ИП Шиц	2026-03-27 10:30:08.54	t	CLIENT	t	f	UTC	2026-03-27 10:30:08.54	t	be0416f5ed9f4f8f9191b7d0af1f0d60	Describe the issue, add a photo if needed, and leave a phone number. We will send the request directly into the company service queue.	t	3	t	REPAIR	t	HIDE_WHEN_VALID
0ab35a18-521a-4b6b-9e86-e10bd3fbd8d1	ИП Ермаков	2026-03-27 10:37:05.217	t	PROVIDER	t	f	UTC	2026-03-27 10:37:05.217	t	b2dd4620599248f0821a1887dd1a9ac7	Describe the issue, add a photo if needed, and leave a phone number. We will send the request directly into the company service queue.	t	3	t	REPAIR	t	HIDE_WHEN_VALID
\.


--
-- Data for Name: DomainEvent; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."DomainEvent" (id, "companyId", "entityType", "entityId", type, "actorUserId", payload, "createdAt") FROM stdin;
\.


--
-- Data for Name: Equipment; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."Equipment" (id, "companyId", "locationId", name, type, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Location; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."Location" (id, "clientCompanyId", name, "platformCode", "externalCode", city, region, address, latitude, longitude, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PermissionBlock; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."PermissionBlock" (id, code, name, description, "createdAt") FROM stdin;
\.


--
-- Data for Name: ProblemCategory; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."ProblemCategory" (id, "companyId", name, instructions, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ProblemCategorySpecialization; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."ProblemCategorySpecialization" ("problemCategoryId", "specializationId") FROM stdin;
\.


--
-- Data for Name: PublicRequestLog; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."PublicRequestLog" (id, "companyId", "tokenHash", "ipHash", "phoneHash", "locationId", channel, action, "createdAt") FROM stdin;
\.


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."RolePermission" (id, role, "permissionBlockId", "createdAt") FROM stdin;
\.


--
-- Data for Name: ServiceContract; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."ServiceContract" (id, "clientCompanyId", "providerCompanyId", status, "startsAt", "endsAt", notes, "createdAt", "updatedAt", role) FROM stdin;
815cc3de-3d04-4264-9c6e-c3f5680653b9	e453953f-f360-48ad-9dd5-4a673f09a94b	0ab35a18-521a-4b6b-9e86-e10bd3fbd8d1	ACTIVE	\N	\N	\N	2026-03-27 10:39:22.031	2026-03-27 10:39:22.031	PRIMARY
\.


--
-- Data for Name: Specialization; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."Specialization" (id, "companyId", name, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TechnicianSpecialization; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."TechnicianSpecialization" ("userId", "specializationId") FROM stdin;
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."Ticket" (id, "companyId", "parentId", "requesterName", "requesterPhone", address, "pointName", "problemCategoryId", "problemText", urgency, status, "slaMinutes", "assignedTechnicianId", "createdAt", "updatedAt", "statusUpdatedAt", "closedAt", "slaBreachedAt", "slaDueAt", "locationId", "equipmentId", source, "publicRequestType") FROM stdin;
\.


--
-- Data for Name: TicketAttachment; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."TicketAttachment" (id, "companyId", "ticketId", "uploadedByUserId", "originalName", "storageKey", "mimeType", "sizeBytes", url, "createdAt") FROM stdin;
\.


--
-- Data for Name: TicketStatusHistory; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."TicketStatusHistory" (id, "ticketId", "fromStatus", "toStatus", comment, "changedByUserId", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."User" (id, email, password, "createdAt", "companyId", role, "isActive", "updatedAt", "firstName", "lastName", "profilePhotoUrl") FROM stdin;
21b4efab-3f9e-4d5e-aca5-405a73f14300	platform.admin@servicemanager.local	$2b$10$iX2gLuFQw4Bl3UaEpFb0TOCLgAwgGEyqXvietvwZBeJ9c82I8vNX6	2026-03-27 10:29:27.125	88b45fe1-fac9-4b76-a2fb-4f1d640f9172	PLATFORM_ADMIN	t	2026-03-27 10:29:27.125	Platform	Admin	\N
f64fea25-abce-4d65-a87e-8b4e064ec637	riofuji102@gmail.com	$2b$10$6ZFr/AgilHXt9pTkMlUxm.hSb2KAE00vRHMdOb84VR00uzGuDL0Ya	2026-03-27 10:33:57.809	e453953f-f360-48ad-9dd5-4a673f09a94b	ADMIN	t	2026-03-27 10:33:57.809	Руслан	Латыев	\N
879c7144-6c4b-4aca-afab-b93aab6fbf32	igor@sushifuji.ru	$2b$10$ep7xObYdB7OEgA5Bk1Rq5.w2zNJNp8z5lo30vzH5zPHdchG86DrEW	2026-03-27 10:39:02.001	0ab35a18-521a-4b6b-9e86-e10bd3fbd8d1	ADMIN	t	2026-03-27 10:39:02.001	Руслан	Латыев	\N
\.


--
-- Data for Name: UserPermission; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public."UserPermission" (id, "userId", "permissionBlockId", "createdAt") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: sma_user
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
c8d49676-e049-4391-8688-01cd324865ea	3f74de70dcff15fb2e1d5c4c704056992fce93b8abbe636b6a687b12d603b7ff	2026-03-22 10:37:17.008233+00	20260219110921_init	\N	\N	2026-03-22 10:37:16.999932+00	1
8c383b85-46d7-4409-a119-789ce88417c3	97632ba13a6dfa81c66117d078120fd2058bbf9a9896111438a03a8f5c39c311	2026-03-22 10:37:17.115467+00	20260303142409_assignment_cursor_v2	\N	\N	2026-03-22 10:37:17.107705+00	1
49533425-6cab-411b-9aea-552aa5e9c8c1	cb2250652d93eb98dd7cae8f52370f07a5e6c90783a808e8401306bab492651b	2026-03-22 10:37:17.016434+00	20260219121916_company_and_roles	\N	\N	2026-03-22 10:37:17.008935+00	1
316bb9d5-518a-4f93-9c24-53ce0fec21aa	9cd6deb8951d896e7c1adaecca055956176d6e3f90a0508ba8f91a7d6df51051	2026-03-22 10:37:17.029841+00	20260219133024_specialties_and_problem_categories	\N	\N	2026-03-22 10:37:17.017027+00	1
dea95395-ddf5-4c71-a275-59c9b1234e00	327ab7ddea16646edb365fd799e8467da5307eff5005ee2467d6921c4ea5ce9e	2026-03-27 10:25:22.909157+00	20260325170000_public_quick_request_v2	\N	\N	2026-03-27 10:25:22.900135+00	1
965374b9-e88d-40fb-9cee-4698f740f0c7	9d8f95bb1f08c28d77fda44f66affcaf0a0449f5a945dbf00d93c9420c26fd89	2026-03-22 10:37:17.03566+00	20260219135246_technician_specializations	\N	\N	2026-03-22 10:37:17.030489+00	1
8f9b770c-eebb-4198-a8cf-2e8c266f66a9	2db81dc9ade142a8de791092156cff7b2a5eed341f1a6efb43084c14e78af1ca	2026-03-22 10:37:17.126367+00	20260314093000_add_ticket_attachments_v1	\N	\N	2026-03-22 10:37:17.116103+00	1
caa2dd83-68fb-4f73-92ce-4c732b7a1d16	4bc62412a79e5c114a23e0ed579327c3287b74359826100bc849f5686d68167e	2026-03-22 10:37:17.046626+00	20260219141214_tickets_v1	\N	\N	2026-03-22 10:37:17.036299+00	1
aefcaa35-ea94-4e38-8793-5ee5b1123cca	168e194a15d6178815feb4382177b3731c9408807c6bffadb54aaa30a20f6dd4	2026-03-22 10:37:17.049265+00	20260219141554_company_auto_assign_flag	\N	\N	2026-03-22 10:37:17.047316+00	1
cdc16aca-0f2e-457a-aeaf-fac8a30fadea	975504ae09a212fe32ef6fd73671c8f5bf3b0949e8594050b207b19d46661525	2026-03-22 10:37:17.061606+00	20260224073607_ticket_status_history	\N	\N	2026-03-22 10:37:17.049906+00	1
148169b2-0e69-4121-bcba-03f4310d7cfe	1288d9914e4efe0d163aa270cb7c074a2417c4f53a3263e99fec4036d8b1532d	2026-03-22 10:37:17.145905+00	20260316090000_add_location_coordinates_v1	\N	\N	2026-03-22 10:37:17.127056+00	1
895184a5-ef8d-4f75-990e-475720ec6aab	6086f607aa20c18ee7278f1a27c9fe076e4e6ab36f00bd70081d1ad4b3f421f0	2026-03-22 10:37:17.064365+00	20260224105524_ticket_sla_tracking_v1	\N	\N	2026-03-22 10:37:17.062275+00	1
2389b67a-3ad0-46aa-b4cb-2987185691e6	47e6832b1010c020b2f25f612977acb51dbf14f5735e127ff09c5cdfe3c53539	2026-03-22 10:37:17.066657+00	20260228031303_add_staff_role	\N	\N	2026-03-22 10:37:17.064906+00	1
ba8622f8-7725-4ec1-af48-0666c9d3add8	56320cbf97714938273462db1a18c8ae42d2d403614fa5023842d32a7168a937	2026-03-22 10:37:17.069161+00	20260228033212_add_master_and_territorial_manager	\N	\N	2026-03-22 10:37:17.067249+00	1
f2165c49-9ed7-4355-af71-41a5c72b0cbb	c33d83f490fd28794075de079bf37ccd831226e6a29d140b18f853f70deca2fa	2026-03-22 10:37:17.148471+00	20260316153000_add_user_names_onboarding_v1	\N	\N	2026-03-22 10:37:17.146515+00	1
20343b54-9502-44e8-b826-cc2f7ba2133d	4d3fa54ba9bf807faf1d49fa4dd87c5df4c4168e834baa4076475893d2f15d04	2026-03-22 10:37:17.09162+00	20260302115458_add_permission_blocks_v1	\N	\N	2026-03-22 10:37:17.069797+00	1
8f31b780-6a26-4ad9-80a0-057c292d9ecf	33a7144c3b782e80926e22d38d0d92fc2a8f20e23f0404da9f0529f18f116619	2026-03-22 10:37:17.098116+00	20260303091822_add_sla_indexes_v1	\N	\N	2026-03-22 10:37:17.092372+00	1
23d18ac9-9576-4b03-be08-90df1d14e1c7	96d5315078456e47aace66d4e06d757be7e3e8774781c3af4eae8acd620785ee	2026-03-27 10:25:22.919465+00	20260326120000_service_contracts_v1	\N	\N	2026-03-27 10:25:22.909795+00	1
dbb6c04a-9ab6-4357-aee6-49c085931984	08f0b3742034b78006303a61d875495c841f02d619254a8d61a5204bc15d6506	2026-03-22 10:37:17.107105+00	20260303132108_add_domain_events_v1	\N	\N	2026-03-22 10:37:17.098756+00	1
e54a689a-b738-4cff-a17e-b3d625b1f33e	eea34d7f62a20e72060bbd5ccbc03637f09c6b40d89932dab9d013d06aec604b	2026-03-22 10:37:17.150916+00	20260319130000_add_user_profile_photo_v1	\N	\N	2026-03-22 10:37:17.149068+00	1
58d69af7-02ff-4583-9532-4d468dc665d1	3ebc99912a269104e607f21630c111d23a7015765401de5cd465bddc3e108e43	2026-03-27 10:25:22.863535+00	20260322103000_platform_admin_company_types_v1	\N	\N	2026-03-27 10:25:22.856406+00	1
93ae63e5-0e3b-4637-be8d-7d73cfe56fbe	c76bd9f77419d80b9bcce19b6d36952ffc866364016732ee53cadcb988c86a81	2026-03-27 10:25:22.889909+00	20260325130000_equipment_v1	\N	\N	2026-03-27 10:25:22.8645+00	1
72abc7ce-8c69-4051-936b-7e970728ab0a	97983b4d63833d29d3109ff403851ca8acdad6bdb149e3d2575e0ad110ccf142	2026-03-27 10:25:22.922654+00	20260326153000_service_contract_roles_phase_b	\N	\N	2026-03-27 10:25:22.920051+00	1
fe974a93-d44e-4838-899d-fc84bca8449a	035ff82f3f71ecf4b63d12be96e6c8be27a72642217506a0f2b228d75ce7e253	2026-03-27 10:25:22.89954+00	20260325150000_public_quick_request_v1	\N	\N	2026-03-27 10:25:22.890611+00	1
\.


--
-- Name: AssignmentCursor AssignmentCursor_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."AssignmentCursor"
    ADD CONSTRAINT "AssignmentCursor_pkey" PRIMARY KEY (id);


--
-- Name: Company Company_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Company"
    ADD CONSTRAINT "Company_pkey" PRIMARY KEY (id);


--
-- Name: DomainEvent DomainEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."DomainEvent"
    ADD CONSTRAINT "DomainEvent_pkey" PRIMARY KEY (id);


--
-- Name: Equipment Equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Equipment"
    ADD CONSTRAINT "Equipment_pkey" PRIMARY KEY (id);


--
-- Name: Location Location_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Location"
    ADD CONSTRAINT "Location_pkey" PRIMARY KEY (id);


--
-- Name: PermissionBlock PermissionBlock_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."PermissionBlock"
    ADD CONSTRAINT "PermissionBlock_pkey" PRIMARY KEY (id);


--
-- Name: ProblemCategorySpecialization ProblemCategorySpecialization_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ProblemCategorySpecialization"
    ADD CONSTRAINT "ProblemCategorySpecialization_pkey" PRIMARY KEY ("problemCategoryId", "specializationId");


--
-- Name: ProblemCategory ProblemCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ProblemCategory"
    ADD CONSTRAINT "ProblemCategory_pkey" PRIMARY KEY (id);


--
-- Name: PublicRequestLog PublicRequestLog_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."PublicRequestLog"
    ADD CONSTRAINT "PublicRequestLog_pkey" PRIMARY KEY (id);


--
-- Name: RolePermission RolePermission_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY (id);


--
-- Name: ServiceContract ServiceContract_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ServiceContract"
    ADD CONSTRAINT "ServiceContract_pkey" PRIMARY KEY (id);


--
-- Name: Specialization Specialization_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Specialization"
    ADD CONSTRAINT "Specialization_pkey" PRIMARY KEY (id);


--
-- Name: TechnicianSpecialization TechnicianSpecialization_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TechnicianSpecialization"
    ADD CONSTRAINT "TechnicianSpecialization_pkey" PRIMARY KEY ("userId", "specializationId");


--
-- Name: TicketAttachment TicketAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketAttachment"
    ADD CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY (id);


--
-- Name: TicketStatusHistory TicketStatusHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketStatusHistory"
    ADD CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY (id);


--
-- Name: Ticket Ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_pkey" PRIMARY KEY (id);


--
-- Name: UserPermission UserPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."UserPermission"
    ADD CONSTRAINT "UserPermission_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AssignmentCursor_companyId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "AssignmentCursor_companyId_idx" ON public."AssignmentCursor" USING btree ("companyId");


--
-- Name: AssignmentCursor_companyId_strategy_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "AssignmentCursor_companyId_strategy_idx" ON public."AssignmentCursor" USING btree ("companyId", strategy);


--
-- Name: AssignmentCursor_companyId_strategy_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "AssignmentCursor_companyId_strategy_key" ON public."AssignmentCursor" USING btree ("companyId", strategy);


--
-- Name: Company_publicRequestToken_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "Company_publicRequestToken_key" ON public."Company" USING btree ("publicRequestToken");


--
-- Name: DomainEvent_companyId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "DomainEvent_companyId_createdAt_idx" ON public."DomainEvent" USING btree ("companyId", "createdAt");


--
-- Name: DomainEvent_companyId_type_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "DomainEvent_companyId_type_createdAt_idx" ON public."DomainEvent" USING btree ("companyId", type, "createdAt");


--
-- Name: DomainEvent_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "DomainEvent_entityType_entityId_idx" ON public."DomainEvent" USING btree ("entityType", "entityId");


--
-- Name: Equipment_companyId_locationId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Equipment_companyId_locationId_idx" ON public."Equipment" USING btree ("companyId", "locationId");


--
-- Name: Equipment_companyId_status_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Equipment_companyId_status_idx" ON public."Equipment" USING btree ("companyId", status);


--
-- Name: Equipment_locationId_status_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Equipment_locationId_status_idx" ON public."Equipment" USING btree ("locationId", status);


--
-- Name: Location_clientCompanyId_city_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Location_clientCompanyId_city_idx" ON public."Location" USING btree ("clientCompanyId", city);


--
-- Name: Location_clientCompanyId_isActive_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Location_clientCompanyId_isActive_idx" ON public."Location" USING btree ("clientCompanyId", "isActive");


--
-- Name: Location_clientCompanyId_platformCode_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "Location_clientCompanyId_platformCode_key" ON public."Location" USING btree ("clientCompanyId", "platformCode");


--
-- Name: PermissionBlock_code_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "PermissionBlock_code_key" ON public."PermissionBlock" USING btree (code);


--
-- Name: ProblemCategory_companyId_isActive_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "ProblemCategory_companyId_isActive_idx" ON public."ProblemCategory" USING btree ("companyId", "isActive");


--
-- Name: ProblemCategory_companyId_name_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "ProblemCategory_companyId_name_key" ON public."ProblemCategory" USING btree ("companyId", name);


--
-- Name: PublicRequestLog_companyId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "PublicRequestLog_companyId_createdAt_idx" ON public."PublicRequestLog" USING btree ("companyId", "createdAt");


--
-- Name: PublicRequestLog_companyId_phoneHash_locationId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "PublicRequestLog_companyId_phoneHash_locationId_createdAt_idx" ON public."PublicRequestLog" USING btree ("companyId", "phoneHash", "locationId", "createdAt");


--
-- Name: PublicRequestLog_companyId_tokenHash_ipHash_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "PublicRequestLog_companyId_tokenHash_ipHash_createdAt_idx" ON public."PublicRequestLog" USING btree ("companyId", "tokenHash", "ipHash", "createdAt");


--
-- Name: RolePermission_permissionBlockId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "RolePermission_permissionBlockId_idx" ON public."RolePermission" USING btree ("permissionBlockId");


--
-- Name: RolePermission_role_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "RolePermission_role_idx" ON public."RolePermission" USING btree (role);


--
-- Name: RolePermission_role_permissionBlockId_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "RolePermission_role_permissionBlockId_key" ON public."RolePermission" USING btree (role, "permissionBlockId");


--
-- Name: ServiceContract_clientCompanyId_providerCompanyId_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "ServiceContract_clientCompanyId_providerCompanyId_key" ON public."ServiceContract" USING btree ("clientCompanyId", "providerCompanyId");


--
-- Name: ServiceContract_clientCompanyId_status_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "ServiceContract_clientCompanyId_status_idx" ON public."ServiceContract" USING btree ("clientCompanyId", status);


--
-- Name: ServiceContract_providerCompanyId_status_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "ServiceContract_providerCompanyId_status_idx" ON public."ServiceContract" USING btree ("providerCompanyId", status);


--
-- Name: Specialization_companyId_isActive_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Specialization_companyId_isActive_idx" ON public."Specialization" USING btree ("companyId", "isActive");


--
-- Name: TicketAttachment_companyId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "TicketAttachment_companyId_createdAt_idx" ON public."TicketAttachment" USING btree ("companyId", "createdAt");


--
-- Name: TicketAttachment_companyId_ticketId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "TicketAttachment_companyId_ticketId_idx" ON public."TicketAttachment" USING btree ("companyId", "ticketId");


--
-- Name: TicketAttachment_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "TicketAttachment_ticketId_createdAt_idx" ON public."TicketAttachment" USING btree ("ticketId", "createdAt");


--
-- Name: TicketStatusHistory_changedByUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "TicketStatusHistory_changedByUserId_createdAt_idx" ON public."TicketStatusHistory" USING btree ("changedByUserId", "createdAt");


--
-- Name: TicketStatusHistory_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "TicketStatusHistory_ticketId_createdAt_idx" ON public."TicketStatusHistory" USING btree ("ticketId", "createdAt");


--
-- Name: TicketStatusHistory_toStatus_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "TicketStatusHistory_toStatus_createdAt_idx" ON public."TicketStatusHistory" USING btree ("toStatus", "createdAt");


--
-- Name: Ticket_companyId_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_companyId_createdAt_idx" ON public."Ticket" USING btree ("companyId", "createdAt");


--
-- Name: Ticket_companyId_slaDueAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_companyId_slaDueAt_idx" ON public."Ticket" USING btree ("companyId", "slaDueAt");


--
-- Name: Ticket_companyId_source_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_companyId_source_idx" ON public."Ticket" USING btree ("companyId", source);


--
-- Name: Ticket_companyId_status_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_companyId_status_idx" ON public."Ticket" USING btree ("companyId", status);


--
-- Name: Ticket_equipmentId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_equipmentId_idx" ON public."Ticket" USING btree ("equipmentId");


--
-- Name: Ticket_locationId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_locationId_idx" ON public."Ticket" USING btree ("locationId");


--
-- Name: Ticket_slaBreachedAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_slaBreachedAt_idx" ON public."Ticket" USING btree ("slaBreachedAt");


--
-- Name: Ticket_slaDueAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_slaDueAt_idx" ON public."Ticket" USING btree ("slaDueAt");


--
-- Name: Ticket_statusUpdatedAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_statusUpdatedAt_idx" ON public."Ticket" USING btree ("statusUpdatedAt");


--
-- Name: Ticket_status_createdAt_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "Ticket_status_createdAt_idx" ON public."Ticket" USING btree (status, "createdAt");


--
-- Name: UserPermission_permissionBlockId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "UserPermission_permissionBlockId_idx" ON public."UserPermission" USING btree ("permissionBlockId");


--
-- Name: UserPermission_userId_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "UserPermission_userId_idx" ON public."UserPermission" USING btree ("userId");


--
-- Name: UserPermission_userId_permissionBlockId_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "UserPermission_userId_permissionBlockId_key" ON public."UserPermission" USING btree ("userId", "permissionBlockId");


--
-- Name: User_companyId_isActive_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "User_companyId_isActive_idx" ON public."User" USING btree ("companyId", "isActive");


--
-- Name: User_companyId_role_idx; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE INDEX "User_companyId_role_idx" ON public."User" USING btree ("companyId", role);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: sma_user
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Equipment Equipment_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Equipment"
    ADD CONSTRAINT "Equipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Equipment Equipment_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Equipment"
    ADD CONSTRAINT "Equipment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."Location"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Location Location_clientCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Location"
    ADD CONSTRAINT "Location_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProblemCategorySpecialization ProblemCategorySpecialization_problemCategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ProblemCategorySpecialization"
    ADD CONSTRAINT "ProblemCategorySpecialization_problemCategoryId_fkey" FOREIGN KEY ("problemCategoryId") REFERENCES public."ProblemCategory"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProblemCategorySpecialization ProblemCategorySpecialization_specializationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ProblemCategorySpecialization"
    ADD CONSTRAINT "ProblemCategorySpecialization_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES public."Specialization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProblemCategory ProblemCategory_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ProblemCategory"
    ADD CONSTRAINT "ProblemCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PublicRequestLog PublicRequestLog_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."PublicRequestLog"
    ADD CONSTRAINT "PublicRequestLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_permissionBlockId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_permissionBlockId_fkey" FOREIGN KEY ("permissionBlockId") REFERENCES public."PermissionBlock"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceContract ServiceContract_clientCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ServiceContract"
    ADD CONSTRAINT "ServiceContract_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceContract ServiceContract_providerCompanyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."ServiceContract"
    ADD CONSTRAINT "ServiceContract_providerCompanyId_fkey" FOREIGN KEY ("providerCompanyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Specialization Specialization_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Specialization"
    ADD CONSTRAINT "Specialization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TechnicianSpecialization TechnicianSpecialization_specializationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TechnicianSpecialization"
    ADD CONSTRAINT "TechnicianSpecialization_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES public."Specialization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TechnicianSpecialization TechnicianSpecialization_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TechnicianSpecialization"
    ADD CONSTRAINT "TechnicianSpecialization_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketAttachment TicketAttachment_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketAttachment"
    ADD CONSTRAINT "TicketAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TicketAttachment TicketAttachment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketAttachment"
    ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TicketAttachment TicketAttachment_uploadedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketAttachment"
    ADD CONSTRAINT "TicketAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TicketStatusHistory TicketStatusHistory_changedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketStatusHistory"
    ADD CONSTRAINT "TicketStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TicketStatusHistory TicketStatusHistory_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."TicketStatusHistory"
    ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Ticket Ticket_assignedTechnicianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Ticket Ticket_equipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES public."Equipment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."Location"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_problemCategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_problemCategoryId_fkey" FOREIGN KEY ("problemCategoryId") REFERENCES public."ProblemCategory"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserPermission UserPermission_permissionBlockId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."UserPermission"
    ADD CONSTRAINT "UserPermission_permissionBlockId_fkey" FOREIGN KEY ("permissionBlockId") REFERENCES public."PermissionBlock"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPermission UserPermission_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."UserPermission"
    ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sma_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict AohRdgL2J02UG9g3tJq8CDuFUDeXRN4KV8FaoFiUYkzNmDbO9GJMcuQbumpsMwN

