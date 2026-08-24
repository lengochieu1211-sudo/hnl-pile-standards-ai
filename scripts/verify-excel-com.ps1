param([string]$Dir = "artifacts/excel-runtime-smoke")
$ErrorActionPreference = "Stop"
$dirPath=(Resolve-Path $Dir).Path
try { $excel=New-Object -ComObject Excel.Application } catch { Write-Error "MICROSOFT EXCEL COM NOT AVAILABLE: $($_.Exception.Message)"; exit 20 }
$excel.Visible=$false; $excel.DisplayAlerts=$false; $excel.AskToUpdateLinks=$false
$report=@()
function Open-Recalc([string]$pattern){
  $file=Get-ChildItem $dirPath -Filter $pattern | Select-Object -First 1
  if(-not $file){ throw "Không tìm thấy $pattern" }
  $wb=$excel.Workbooks.Open($file.FullName)
  $excel.CalculateFullRebuild()
  return @($wb,$file)
}
try {
  # 7888: D600-B -> D800-B must recalc lookup + A0 + Ra/Pmax.
  $a=Open-Recalc "HNL_TCVN7888_*.xlsx"; $wb=$a[0]; $file=$a[1]
  $inp=$wb.Worksheets.Item("01_INPUT"); $calc=$wb.Worksheets.Item("03_TINH_TOAN")
  $r0=[double]$calc.Range("B7").Value2; $p0=[double]$calc.Range("B9").Value2
  $inp.Range("B4").Value2=800; $excel.CalculateFullRebuild()
  $r1=[double]$calc.Range("B7").Value2; $p1=[double]$calc.Range("B9").Value2
  if([math]::Abs($r0-3007.581286966663)-gt 1e-6 -or [math]::Abs($p0-4812.130059146661)-gt 1e-6){throw "7888 D600 benchmark lệch: $r0 / $p0"}
  if([math]::Abs($r1-4973.320690212848)-gt 1e-6 -or [math]::Abs($p1-7957.3131043405565)-gt 1e-6){throw "7888 D800 recalc lệch: $r1 / $p1"}
  $report += [pscustomobject]@{workflow="7888";initial=$r0;changed=$r1;status="PASS"}; $wb.Close($false)

  # 10304 driven: change IL layer 2, total Rk must change and formulas stay live.
  $a=Open-Recalc "HNL_TCVN10304_Coc_Dong_Ep_Workflow.xlsx"; $wb=$a[0]
  $geo=$wb.Worksheets.Item("02_DIA_CHAT"); $calc=$wb.Worksheets.Item("05_CALC_10304")
  $rk0=[double]$calc.Range("B9").Value2; $geo.Range("F3").Value2=0.4; $excel.CalculateFullRebuild(); $rk1=[double]$calc.Range("B9").Value2
  if([math]::Abs($rk1-$rk0)-lt 1e-6){throw "10304 không recalculation khi đổi IL lớp 2"}
  $report += [pscustomobject]@{workflow="10304-driven";initial=$rk0;changed=$rk1;status="PASS"}; $wb.Close($false)

  # 5574 bending: change M only -> Mu unchanged, utilization changes; change As -> Mu changes.
  $a=Open-Recalc "HNL_TCVN5574_5574-bending-rect_*.xlsx"; $wb=$a[0]
  $inp=$wb.Worksheets.Item("01_INPUT"); $calc=$wb.Worksheets.Item("03_TINH_TOAN")
  # Find input row by label, rather than hard-code row numbers.
  function Row-ByLabel($sheet,[string]$label){
    $used=$sheet.UsedRange; for($r=1;$r-le $used.Rows.Count;$r++){if([string]$sheet.Cells.Item($r,1).Value2 -eq $label){return $r}}; throw "Không thấy input $label"
  }
  function Calc-BySymbol($sheet,[string]$symbol){
    $used=$sheet.UsedRange; for($r=1;$r-le $used.Rows.Count;$r++){if([string]$sheet.Cells.Item($r,2).Value2 -eq $symbol){return $r}}; throw "Không thấy calc $symbol"
  }
  $mRow=Row-ByLabel $inp "M"; $asRow=Row-ByLabel $inp "As"; $muRow=Calc-BySymbol $calc "Mu"; $ratioRow=Calc-BySymbol $calc "M/Mu"
  $mu0=[double]$calc.Cells.Item($muRow,4).Value2; $u0=[double]$calc.Cells.Item($ratioRow,4).Value2
  $inp.Cells.Item($mRow,2).Value2=250; $excel.CalculateFullRebuild(); $muM=[double]$calc.Cells.Item($muRow,4).Value2; $uM=[double]$calc.Cells.Item($ratioRow,4).Value2
  if([math]::Abs($muM-$mu0)-gt 1e-6 -or [math]::Abs($uM-$u0)-lt 1e-6){throw "5574 đổi M không đúng logic"}
  $inp.Cells.Item($mRow,2).Value2=200; $inp.Cells.Item($asRow,2).Value2=2000; $excel.CalculateFullRebuild(); $muAs=[double]$calc.Cells.Item($muRow,4).Value2
  if([math]::Abs($muAs-$mu0)-lt 1e-6){throw "5574 đổi As không làm Mu thay đổi"}
  $report += [pscustomobject]@{workflow="5574-bending";initialMu=$mu0;changedMu=$muAs;status="PASS"}; $wb.Close($false)

  $report | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $dirPath "microsoft-excel-recalc.json")
  Write-Host "MICROSOFT EXCEL RECALC PASS"
  $report | Format-Table -AutoSize
} finally { if($excel){$excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)|Out-Null} }
