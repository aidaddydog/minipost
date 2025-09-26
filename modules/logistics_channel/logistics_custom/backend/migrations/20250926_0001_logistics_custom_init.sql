-- PostgreSQL 16+ 幂等迁移：logistics_custom / logistics_custom_channel
-- 说明：
-- - 仅使用 IF NOT EXISTS / DO $$ BEGIN $$ 语法，确保可重复执行
-- - 与 ORM 定义保持一致

-- 1) ENUM：status_common（若不存在则创建；存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_common') THEN
    CREATE TYPE status_common AS ENUM ('draft','active','inactive','archived');
  END IF;
END $$;

-- 2) ENUM：transport_mode
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_mode') THEN
    CREATE TYPE transport_mode AS ENUM ('express','postal','air','sea','rail','truck','multimodal','pickup','local_courier');
  END IF;
END $$;

-- 3) logistics_custom
CREATE TABLE IF NOT EXISTS logistics_custom (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  provider_name VARCHAR(100) NOT NULL,
  service_code VARCHAR(32) NOT NULL,
  status status_common NOT NULL DEFAULT 'active',
  ship_from JSONB NULL,
  label_template_code VARCHAR(64) NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL,
  remark VARCHAR(255) NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL
);

-- 仅未软删时唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_custom_uniq_provider
  ON logistics_custom(tenant_id, provider_name) WHERE deleted_at IS NULL;

-- 4) logistics_custom_channel
CREATE TABLE IF NOT EXISTS logistics_custom_channel (
  id UUID PRIMARY KEY,
  custom_id UUID NOT NULL REFERENCES logistics_custom(id) ON DELETE RESTRICT,
  channel_name VARCHAR(100) NOT NULL,
  transport_mode transport_mode NOT NULL,
  platform_mapping JSONB NOT NULL DEFAULT '{{}}'::jsonb,
  is_selectable BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INT NOT NULL DEFAULT 0,
  status status_common NOT NULL DEFAULT 'active',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL,
  remark VARCHAR(255) NULL,
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL
);

-- 渠道名在同 provider 下唯一（未软删）
CREATE UNIQUE INDEX IF NOT EXISTS uq_lcc_channel_name_not_deleted
  ON logistics_custom_channel(custom_id, channel_name) WHERE deleted_at IS NULL;
