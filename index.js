const fs = require("fs");
const path = require("path");

const DEFAULT_OIDC_AUDIENCE = "api://AzureADTokenExchange";
const fetchApi = resolveFetch();

function resolveFetch() {
    if (typeof globalThis.fetch === "function") {
        return globalThis.fetch.bind(globalThis);
    }

    try {
        const nodeFetch = require("node-fetch");
        return nodeFetch.default || nodeFetch;
    } catch (error) {
        throw new Error("No fetch implementation available. Install node-fetch or use Node.js 18+ runtime.");
    }
}

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function normalizeSiteUrl(siteUrl) {
    return siteUrl.replace(/\/+$/, "");
}

function normalizeRepositorySlug(repository) {
    return repository.replace(/\//g, "_");
}

function quoteODataString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}

function buildServerRelativeFolder(siteUrl, libraryFolder) {
    const sitePath = new URL(siteUrl).pathname.replace(/\/+$/, "");
    const trimmedFolder = libraryFolder.replace(/^\/+|\/+$/g, "");

    if (!trimmedFolder) {
        throw new Error("LIB_FOLDER must not be empty.");
    }

    const combined = `${sitePath}/${trimmedFolder}`.replace(/\/{2,}/g, "/");
    return combined.startsWith("/") ? combined : `/${combined}`;
}

function buildFileName(filePath) {
    const extension = path.extname(filePath);
    const repository = normalizeRepositorySlug(requiredEnv("GITHUB_REPOSITORY"));
    const sha = requiredEnv("GITHUB_SHA").substring(0, 7);
    return `${repository}_${sha}${extension}`;
}

async function getGitHubOidcToken(audience) {
    const idTokenRequestUrl = requiredEnv("ACTIONS_ID_TOKEN_REQUEST_URL");
    const idTokenRequestToken = requiredEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
    const separator = idTokenRequestUrl.includes("?") ? "&" : "?";
    const tokenUrl = `${idTokenRequestUrl}${separator}audience=${encodeURIComponent(audience)}`;

    const response = await fetchApi(tokenUrl, {
        headers: {
            Authorization: `Bearer ${idTokenRequestToken}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch GitHub OIDC token: ${response.status} ${errorText}`);
    }

    const payload = await response.json();

    if (!payload.value) {
        throw new Error("GitHub OIDC response did not contain a token value.");
    }

    return payload.value;
}

async function exchangeForSharePointAccessToken(tenantId, clientId, siteUrl, oidcToken) {
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const siteOrigin = new URL(siteUrl).origin;
    const body = new URLSearchParams({
        client_id: clientId,
        scope: `${siteOrigin}/.default`,
        grant_type: "client_credentials",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: oidcToken,
    });

    const response = await fetchApi(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    const payloadText = await response.text();

    if (!response.ok) {
        throw new Error(`Failed to exchange OIDC token for SharePoint token: ${response.status} ${payloadText}`);
    }

    let payload;
    try {
        payload = JSON.parse(payloadText);
    } catch (error) {
        throw new Error(`Token endpoint returned a non-JSON payload: ${payloadText}`);
    }

    if (!payload.access_token) {
        throw new Error(`Token endpoint response did not include access_token: ${payloadText}`);
    }

    return payload.access_token;
}

async function uploadFileToSharePoint(siteUrl, libraryFolder, fileName, fileContent, accessToken) {
    const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
    const serverRelativeFolder = buildServerRelativeFolder(normalizedSiteUrl, libraryFolder);

    const query = new URLSearchParams({
        "@a1": quoteODataString(serverRelativeFolder),
        "@a2": quoteODataString(fileName),
    });

    const uploadUrl = `${normalizedSiteUrl}/_api/web/GetFolderByServerRelativePath(decodedurl=@a1)/Files/add(url=@a2,overwrite=true)?${query.toString()}`;
    const response = await fetchApi(uploadUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json;odata=nometadata",
            "Content-Type": "application/octet-stream",
        },
        body: fileContent,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload file to SharePoint: ${response.status} ${errorText}`);
    }
}

async function main() {
    const authMode = (process.env.AUTH_MODE || "oidc").toLowerCase();

    if (authMode !== "oidc") {
        throw new Error("Unsupported AUTH_MODE. v2 only supports 'oidc' because Microsoft retires Azure ACS-based Sharepoint Online auth on April 2, 2026.");
    }

    const siteUrl = requiredEnv("SITE_URL");
    const tenantId = requiredEnv("AZURE_TENANT_ID");
    const clientId = requiredEnv("AZURE_CLIENT_ID");
    const oidcAudience = process.env.AZURE_CLIENT_ASSERTION_AUDIENCE || DEFAULT_OIDC_AUDIENCE;
    const libraryFolder = requiredEnv("LIB_FOLDER");
    const filePath = requiredEnv("FILE_PATH");

    if (!fs.existsSync(filePath)) {
        throw new Error(`Configured FILE_PATH does not exist: ${filePath}`);
    }

    const fileName = buildFileName(filePath);
    const fileContent = fs.readFileSync(filePath);
    const oidcToken = await getGitHubOidcToken(oidcAudience);
    const accessToken = await exchangeForSharePointAccessToken(tenantId, clientId, siteUrl, oidcToken);

    await uploadFileToSharePoint(siteUrl, libraryFolder, fileName, fileContent, accessToken);
    console.log("Success");
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
