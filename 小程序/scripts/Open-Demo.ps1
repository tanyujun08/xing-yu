param([string]$AppId)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $project 'project.config.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if ($AppId) {
    if ($AppId -notmatch '^wx[a-fA-F0-9]{16}$') { throw '请输入有效的公开测试 AppID（wx 开头），不是 AppSecret。' }
    $config.appid = $AppId
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding utf8
}
if ($config.appid -eq 'touristappid') {
    throw '本机 CLI 拒绝 touristappid。请带 -AppId 测试AppID，或在微信开发者工具手动导入并选择测试号。'
}
$cli = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
if (-not (Test-Path $cli)) { throw '找不到本机微信开发者工具，请在工具内手动导入此文件夹。' }
& $cli open --project $project
if ($LASTEXITCODE -ne 0) { throw '开发者工具未成功打开，请检查工具提供的错误。' }
