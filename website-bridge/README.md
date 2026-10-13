# DDPro website bridge (IHS deployment preparation)

These files are a new, isolated bridge. They do not modify the existing site,
its database, or its form handlers. The CMS gateway fails closed until a
site-specific adapter is implemented after the current PHP/storage structure
has been inspected.

## CMS gateway

The confirmed document root is `/rootFolder/httpdocs/`. Create only this new
directory and upload these two files; do not replace or edit the existing
`index.php`, `panel/`, `system/`, `tema/`, `galeri/`, or `language/` files:

- `website-bridge/cms/index.php` → `/rootFolder/httpdocs/ddpro-cms/index.php`
- `website-bridge/cms/.htaccess` → `/rootFolder/httpdocs/ddpro-cms/.htaccess`

The provider base URL will be `https://www.ddizaynpro.com/ddpro-cms`. The
`.htaccess` route requires Apache `mod_rewrite` and `AllowOverride`; ask IHS to
confirm these are enabled. Configure PHP production with `display_errors=Off`.

Set these IHS PHP-process environment variables outside the web root:

- `WEBSITE_CMS_API_TOKEN`: same secret configured in Render; never put it in PHP source.
- `DDPRO_CMS_ADAPTER_FILE=/rootFolder/ddpro-private/cms-adapter.php`: private
  adapter path outside the document root. Create/use this parent directory
  only if IHS confirms it is writable and accessible to PHP.

The private adapter must define `ddproCmsList($contentType)`,
`ddproCmsGet($contentType, $id)`, `ddproCmsCreate($contentType, $body)`, and
`ddproCmsUpdate($contentType, $id, $body)`. It must map only `pages`,
`products`, and `references` to the site's verified existing data model and
return JSON-serializable values. No table names or schema are assumed here.
No adapter file is included or ready to upload because the PHP data layer and
schema have not been provided. Until that private file is implemented from
verified site code, the gateway returns an error and CMS must not be shown as
connected.

## Existing website lead form

`lead-forwarder.php` is a library for the site's existing server-side form
handler to include and call after mapping its validated form fields into an
array. Do not change the live form until its current handler and email flow are
reviewed and backed up. When that review is complete, upload this new file
outside the web root:

- `website-bridge/lead-forwarder.php` → `/rootFolder/ddpro-private/lead-forwarder.php`

Configure IHS PHP-process environment variables:

- `DDPRO_WEBSITE_LEAD_WEBHOOK_URL`: the actual HTTPS Render backend origin,
  ending exactly in `/webhooks/website/leads`. Obtain the origin from the
  Render service dashboard; it is not specified in this repository.
- `WEBSITE_WEBHOOK_SECRET`: same secret configured in Render.

The library signs the exact JSON body sent using HMAC-SHA256 and the
`X-DDPro-Signature: sha256=<hex>` header. It requires PHP cURL with TLS peer
and hostname verification. The caller must preserve its current email behavior
and handle forwarding failures without logging payloads or secrets. This file
is not connected to the existing form handler yet; its path is an additive
installation target, not a completed production form change.

## Render backend

Configure `WEBSITE_WEBHOOK_SECRET`, `WEBSITE_CMS_API_URL`, and
`WEBSITE_CMS_API_TOKEN` in the backend service environment only. Use the IHS
gateway base URL above for `WEBSITE_CMS_API_URL` after the adapter and route
are installed. The lead webhook additionally requires existing backend
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configuration and working CRM
storage. These settings are not changed here. Run the CMS connection test and
verify a signed lead reaches CRM before treating the integration as connected.
No production changes or live connection test were performed as part of
preparing these files.

## IHS variables at a glance

| Variable | IHS location/value |
| --- | --- |
| `WEBSITE_CMS_API_TOKEN` | IHS PHP process environment; same secret as Render |
| `DDPRO_CMS_ADAPTER_FILE` | `/rootFolder/ddpro-private/cms-adapter.php` (future; not supplied) |
| `WEBSITE_WEBHOOK_SECRET` | IHS PHP process environment; same secret as Render |
| `DDPRO_WEBSITE_LEAD_WEBHOOK_URL` | Actual Render HTTPS origin plus `/webhooks/website/leads` |

## Render variables at a glance

| Variable | Render backend value |
| --- | --- |
| `WEBSITE_WEBHOOK_SECRET` | Secret shared with the IHS PHP process |
| `WEBSITE_CMS_API_URL` | `https://www.ddizaynpro.com/ddpro-cms` after CMS adapter setup |
| `WEBSITE_CMS_API_TOKEN` | Secret shared with the IHS PHP process |
| `SUPABASE_URL` | Existing Supabase project URL (needed for CRM writes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server-only service-role key (needed for CRM writes) |

The repository does not contain IHS credentials or the Render service origin,
so neither environment configuration nor a live connection can be verified
from this checkout.
