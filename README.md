# action-sharepoint-publish (UASI fork)

This action creates an archive of the current repository and uploads it to a Sharepoint library.

Uploaded file names are stable by default and do not include the commit SHA.

## Breaking Change in v2

Version `2.x` removes client-secret auth and uses GitHub OIDC federation with an Entra app registration.

- v1 auth (`sharepoint_client_id` + `sharepoint_client_secret`) is no longer supported because Microsoft retired Azure ACS for Sharepoint Online, and it stops working on April 2, 2026. Reference: [Azure ACS retirement in Microsoft 365](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/retirement-announcement-for-azure-acs).
- v2 requires workflow permission `id-token: write`.

## Required Entra Setup

1. Create or use an Entra app registration with Sharepoint application permissions.
2. Add a federated credential for your GitHub repo/workflow context.
3. Grant admin consent for the Sharepoint permissions on that app registration.

## Inputs

- `auth_mode` (optional, default: `oidc`) - v2 only supports `oidc`.
- `site_url` (required) - full Sharepoint site URL (for example `https://contoso.sharepoint.com/sites/MySite`).
- `azure_client_id` (required) - Entra app registration (service principal) client ID.
- `azure_tenant_id` (required) - Entra tenant ID.
- `library_folder` (required, default: `Shared documents`) - library path under the target site.
- `file_path` (optional) - specific file to upload instead of auto-zipping the repository.
- `azure_client_assertion_audience` (optional, default: `api://AzureADTokenExchange`) - audience used when requesting the GitHub OIDC token.
- `azure_subscription_id` (optional) - accepted for caller-workflow parity; not used by this action.

## Uploaded Filename

- The uploaded file name is `<owner_repo><extension>`.
- Example: repository `contoso/finance-workflow-publisher` uploads as `contoso_finance-workflow-publisher.zip`.
- SharePoint upload uses `overwrite=true`, so existing files with the same name are replaced and versioned by SharePoint.

## Example Usage

```yaml
name: Publish Repo Source to Sharepoint

on:
  push:
    branches:
      - main

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Publish repository archive to Sharepoint
        uses: UASI-Solutions/action-sharepoint-publish@v2
        with:
          auth_mode: oidc
          site_url: ${{ vars.SHAREPOINT_SITE_URL }}
          library_folder: ${{ vars.SHAREPOINT_LIBRARY_FOLDER }}
          azure_client_id: ${{ secrets.AZURE_CLIENT_ID }}
          azure_tenant_id: ${{ secrets.AZURE_TENANT_ID }}
```
