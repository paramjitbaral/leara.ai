const { execSync } = require('child_process');
const stdout = execSync('powershell -NoProfile -Command "Get-ChildItem Env: | ForEach-Object { $_.Key + \'=\' + $_.Value }"');
console.log(stdout.toString().substring(0, 100));
