# Push all .env vars to Vercel production
# Run from project root: .\scripts\push-vercel-env.ps1

$envFile = ".\.env"
$env_vars = @{}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and !$line.StartsWith("#")) {
        $idx = $line.IndexOf("=")
        if ($idx -gt 0) {
            $key = $line.Substring(0, $idx).Trim()
            $val = $line.Substring($idx + 1).Trim()
            # Remove surrounding single quotes
            if ($val.StartsWith("'") -and $val.EndsWith("'")) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            $env_vars[$key] = $val
        }
    }
}

$required = @(
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "OAUTH_STATE_SECRET",
    "BOOTSTRAP_DISCORD_IDS",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "GROQ_API_KEY",
    "GROQ_MODEL"
)

foreach ($key in $required) {
    if ($env_vars.ContainsKey($key)) {
        $val = $env_vars[$key]
        Write-Host "Setting $key ..." -ForegroundColor Cyan
        # Use echo to pipe value to vercel env add
        $val | vercel env add $key production --force 2>&1
        Write-Host "  Done: $key" -ForegroundColor Green
    } else {
        Write-Host "  MISSING in .env: $key" -ForegroundColor Red
    }
}

Write-Host "`nAll env vars pushed. Run: vercel --prod --yes" -ForegroundColor Yellow
