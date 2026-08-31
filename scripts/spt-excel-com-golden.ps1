$ErrorActionPreference = 'Stop'
$path = (Resolve-Path 'artifacts/spt-excel-golden/HNL_SPT_GOLDEN.xlsx').Path
$excel = $null; $book = $null
function Find-Row($sheet, [string]$label) {
  for ($r=1; $r -le $sheet.UsedRange.Rows.Count; $r++) {
    if ([string]$sheet.Cells.Item($r,1).Text -eq $label) { return $r }
  }
  throw "Missing row label '$label' in $($sheet.Name)"
}
function Near([double]$actual,[double]$expected,[double]$tol,[string]$name){ if([math]::Abs($actual-$expected) -gt $tol){ throw "$name expected $expected got $actual" } }
try {
  try { $excel = New-Object -ComObject Excel.Application }
  catch { throw "EXCEL_COM_ENVIRONMENT_UNAVAILABLE: Microsoft Excel.Application COM is not registered on this runner. $($_.Exception.Message)" }
  $excel.Visible = $false; $excel.DisplayAlerts = $false
  $book = $excel.Workbooks.Open($path)
  $inp=$book.Worksheets.Item('01_INPUT'); $calc=$book.Worksheets.Item('02_CALC')
  $section=Find-Row $inp 'Tiết diện'; $b=Find-Row $inp 'b'; $h=Find-Row $inp 'h'; $d=Find-Row $inp 'D'; $nbar=Find-Row $inp 'N̄ vùng mũi'; $ns=Find-Row $inp 'Ns thân cọc'
  $ab=Find-Row $calc 'A_b'; $u=Find-Row $calc 'u'; $qb=Find-Row $calc 'q_b'; $fs=Find-Row $calc 'f_s'; $rub=Find-Row $calc 'R_u,b'; $ruf=Find-Row $calc 'R_u,f'; $rk=Find-Row $calc 'R_c,k / R_k'; $rd=Find-Row $calc 'R_d'
  $excel.CalculateFullRebuild()
  Near ([double]$calc.Cells.Item($ab,2).Value2) 0.16 1e-8 'A Ab'
  Near ([double]$calc.Cells.Item($u,2).Value2) 1.6 1e-8 'A u'
  Near ([double]$calc.Cells.Item($qb,2).Value2) 6000 1e-6 'A qb'
  Near ([double]$calc.Cells.Item($fs,2).Value2) 40 1e-6 'A fs'
  Near ([double]$calc.Cells.Item($rub,2).Value2) 960 1e-6 'A Rub'
  Near ([double]$calc.Cells.Item($ruf,2).Value2) 640 1e-6 'A Ruf'
  Near ([double]$calc.Cells.Item($rk,2).Value2) 1600 1e-6 'A Rck'
  Near ([double]$calc.Cells.Item($rd,2).Value2) (1600/1.5) 1e-6 'A Rd'

  # TEST B: only Nbar = 30
  $inp.Cells.Item($nbar,2).Value2=30; $excel.CalculateFullRebuild()
  Near ([double]$calc.Cells.Item($qb,2).Value2) 9000 1e-6 'B qb'
  Near ([double]$calc.Cells.Item($rub,2).Value2) 1440 1e-6 'B Rub'

  # TEST C: square 300 x 300 mm, restore Nbar=20
  $inp.Cells.Item($nbar,2).Value2=20; $inp.Cells.Item($b,2).Value2=300; $inp.Cells.Item($h,2).Value2=300; $excel.CalculateFullRebuild()
  Near ([double]$calc.Cells.Item($ab,2).Value2) 0.09 1e-8 'C Ab'
  Near ([double]$calc.Cells.Item($u,2).Value2) 1.2 1e-8 'C u'

  # TEST D: cap rules
  $inp.Cells.Item($b,2).Value2=400; $inp.Cells.Item($h,2).Value2=400; $inp.Cells.Item($nbar,2).Value2=80; $inp.Cells.Item($ns,2).Value2=70; $excel.CalculateFullRebuild()
  Near ([double]$calc.Cells.Item($qb,2).Value2) 18000 1e-6 'D qb cap'
  Near ([double]$calc.Cells.Item($fs,2).Value2) 100 1e-6 'D fs cap'

  # TEST E: rectangle 400 x 600 mm, restore SPT values
  $inp.Cells.Item($section,2).Value2='Chữ nhật'; $inp.Cells.Item($b,2).Value2=400; $inp.Cells.Item($h,2).Value2=600; $inp.Cells.Item($d,2).Value2=''; $inp.Cells.Item($nbar,2).Value2=20; $inp.Cells.Item($ns,2).Value2=20; $excel.CalculateFullRebuild()
  Near ([double]$calc.Cells.Item($ab,2).Value2) 0.24 1e-8 'E Ab'
  Near ([double]$calc.Cells.Item($u,2).Value2) 2.0 1e-8 'E u'
  Near ([double]$calc.Cells.Item($rub,2).Value2) 1440 1e-6 'E Rub'
  Near ([double]$calc.Cells.Item($ruf,2).Value2) 800 1e-6 'E Ruf'

  # TEST F: circular D600
  $inp.Cells.Item($section,2).Value2='Tròn'; $inp.Cells.Item($b,2).Value2=''; $inp.Cells.Item($h,2).Value2=''; $inp.Cells.Item($d,2).Value2=600; $excel.CalculateFullRebuild()
  Near ([double]$calc.Cells.Item($ab,2).Value2) ([math]::PI*0.6*0.6/4) 1e-8 'F Ab'
  Near ([double]$calc.Cells.Item($u,2).Value2) ([math]::PI*0.6) 1e-8 'F u'
  Near ([double]$calc.Cells.Item($rub,2).Value2) (6000*[math]::PI*0.6*0.6/4) 1e-5 'F Rub'
  Near ([double]$calc.Cells.Item($ruf,2).Value2) (40*10*[math]::PI*0.6) 1e-5 'F Ruf'

  $book.Save()
  Write-Host 'SPT EXCEL COM GOLDEN: PASS (A/B/C/D/E/F)'
}
finally {
  if($book){$book.Close($false)}
  if($excel){$excel.Quit()}
  [gc]::Collect(); [gc]::WaitForPendingFinalizers()
}
