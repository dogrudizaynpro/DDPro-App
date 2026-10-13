# DDPro website bridge (IHS deployment preparation)

These files are a new, isolated bridge. They do not modify the existing site,
its database, or its form handlers. The CMS gateway fails closed until a
site-specific adapter is implemented after the current PHP/storage structure
has been inspected.

## CMS gateway

Upload the contents of `cms/` as a new directory named `ddpro-cms/` under the
site document root, without replacing existing files. The resulting DDPro
provider base URL is `https://www.ddizaynpro.com/ddpro-cms`. The included
`.htaccess` requires Apache `mod_rewrite` and `AllowOverride`; confirm both
with IHS before enabling the route.

Set these IHS PHP-process environment variables outside the web root:

- `WEBSITE_CMS_API_TOKEN`: same secret configured in Render; never put it in PHP source.
- `DDPRO_CMS_ADAPTER_FILE`: absolute path to a private PHP adapter outside the document root.

The private adapter must define `ddproCmsList($contentType)`,
`ddproCmsGet($contentType, $id)`, `ddproCmsCreate($contentType, $body)`, and
`ddproCmsUpdate($contentType, $id, $body)`. It must map only `pages`,
`products`, and `references` to the site's verified existing data model and
return JSON-serializable values. No table names or schema are assumed here.
Until this adapter exists, the bridge returns an error and the DDPro CMS test
must not report connected.

## Existing website lead form

`lead-forwarder.php` is a library for the site's existing server-side form
handler to include and call after mapping its validated form fields into an
array. Do not change the live form until its current handler and email flow are
reviewed and backed up. Configure IHS environment variables:

- `DDPRO_WEBSITE_LEAD_WEBHOOK_URL`: HTTPS Render backend URL ending exactly in `/webhooks/website/leads`.
- `WEBSITE_WEBHOOK_SECRET`: same secret configured in Render.

The library signs the exact JSON body sent using HMAC-SHA256 and the
`X-DDPro-Signature: sha256=<hex>` header. It requires PHP cURL with TLS peer
and hostname verification. The caller must preserve its current email behavior
and handle forwarding failures without logging payloads or secrets.

## Render backend

Configure `WEBSITE_WEBHOOK_SECRET`, `WEBSITE_CMS_API_URL`, and
`WEBSITE_CMS_API_TOKEN` in the backend service environment only. Use the IHS
gateway base URL above after the adapter and route are installed. Run the CMS
connection test and verify a signed lead reaches CRM before treating the
integration as connected. No production changes or live connection test were
performed as part of preparing these files.
