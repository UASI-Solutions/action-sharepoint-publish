# action-sharepoint-publish (UASI fork)

A simple GitHub Action that creates an archive of a repository and uploads it to a Sharepoint library.

This repository is maintained by UASI Solutions as a fork of `obrassard/action-sharepoint-publish`.

## Inputs

### Example Inputs

```yaml
# The complete URL of your Sharepoint site.
site_url: 'https://you.sharepoint.com/sites/mySite'

# The path relative to the library where to upload a file.
library_folder: 'Shared Documents/Github Sync'

# The client ID to use for authentication.
sharepoint_client_id: 'e2315739-2bca-4d89-a49b-31abc3ce378f'

# The Sharepoint client secret.
sharepoint_client_secret: 'JVrYn+jdyLk5buuhMtA0CKY9dnv4SMj2SdpZy5Ljcte='
```

> :bulb: Tip : It is recommended to use GitHub Actions Secrets to store sensitive informations like client secrets and id

## Example usage

This action is particularly useful when triggered by push:

```yaml
name: 'Sharepoint Sync'

on: push

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
    - name: Cloning repo
      uses: actions/checkout@v4

    - name: Publish to Sharepoint
      uses: UASI-Solutions/action-sharepoint-publish@main
      with:
        site_url: 'https://you.sharepoint.com/sites/mySite'
        library_folder: 'Shared documents/releases'
        sharepoint_client_id: ${{ secrets.CLIENTID }}
        sharepoint_client_secret: ${{ secrets.CLIENTSECRET }}
```
