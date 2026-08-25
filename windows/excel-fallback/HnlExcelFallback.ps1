param(
  [Parameter(Mandatory=$true)][string]$InputWorkbook,
  [Parameter(Mandatory=$true)][string]$OutputJson
)
$ErrorActionPreference='Stop'
$sheetRoles=@{
  'pointCoordinates'='Point Coordinates'
  'nodalReactions'='Nodal Reactions'
  'pointSpringAssignments'='Point Spring Assignments'
  'pierForces'='PIERFORCES'
  'pierSection'='PIERSECTION'
}
$excel=$null; $wb=$null
try {
  $excel=New-Object -ComObject Excel.Application
  $excel.Visible=$false; $excel.DisplayAlerts=$false
  $wb=$excel.Workbooks.Open((Resolve-Path $InputWorkbook).Path,0,$true)
  $tables=@{}
  foreach($role in $sheetRoles.Keys) {
    $name=$sheetRoles[$role]; $ws=$null
    try {$ws=$wb.Worksheets.Item($name)} catch {continue}
    $used=$ws.UsedRange; $vals=$used.Value2
    if($null -eq $vals) {continue}
    $rCount=$used.Rows.Count; $cCount=$used.Columns.Count
    $headers=@(); for($c=1;$c -le $cCount;$c++){ $headers += [string]$vals[1,$c] }
    $rows=@()
    for($r=2;$r -le $rCount;$r++){
      $o=[ordered]@{_sourceRow=$r}
      for($c=1;$c -le $cCount;$c++){ $h=$headers[$c-1]; if([string]::IsNullOrWhiteSpace($h)){$h="Column$c"}; $o[$h]=$vals[$r,$c] }
      $rows += [pscustomobject]$o
    }
    $tables[$role]=@{role=$role;tableName=$name;rows=$rows}
  }
  $payload=@{ok=$true;sourceMode='EXCEL_FALLBACK';product='OFFLINE_TABLES';units=@{normalizedTo='kN_m_C';verified=$false;note='Workbook units are not changed by fallback; caller must supply verified source profile.'};tables=$tables}
  $payload | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $OutputJson
} catch {
  @{ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $OutputJson
  exit 2
} finally {
  if($wb){$wb.Close($false)}
  if($excel){$excel.Quit()}
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
