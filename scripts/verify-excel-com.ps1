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

  # P0 Pass 3 rock: RQD must drive Ks -> Rm -> qb -> Rk with live Excel formulas.
  $a=Open-Recalc "HNL_TCVN10304_Rock_EndBearing_P0Pass3_*.xlsx"; $wb=$a[0]
  $inp=$wb.Worksheets.Item("01_DAU_VAO"); $calc=$wb.Worksheets.Item("CALC_ROCK")
  function Row-ByLabel1($sheet,[string]$label){
    $used=$sheet.UsedRange; for($r=1;$r-le $used.Rows.Count;$r++){if([string]$sheet.Cells.Item($r,1).Value2 -eq $label){return $r}}; throw "Không thấy label $label"
  }
  $rqdRow=Row-ByLabel1 $inp "RQD"; $ksRow=Row-ByLabel1 $calc "Ks"; $rkRow=Row-ByLabel1 $calc "Rk"
  $ks0=[double]$calc.Cells.Item($ksRow,2).Value2; $rk0=[double]$calc.Cells.Item($rkRow,2).Value2
  if([math]::Abs($ks0-0.24)-gt 1e-9){throw "Rock Ks benchmark lệch: $ks0"}
  $inp.Cells.Item($rqdRow,2).Value2=50; $excel.CalculateFullRebuild(); $ks1=[double]$calc.Cells.Item($ksRow,2).Value2; $rk1=[double]$calc.Cells.Item($rkRow,2).Value2
  if([math]::Abs($ks1-0.32)-gt 1e-9 -or [math]::Abs($rk1-$rk0)-lt 1e-6){throw "Rock RQD recalc lệch: Ks=$ks1 Rk=$rk1"}
  $report += [pscustomobject]@{workflow="10304-rock-raw";initialKs=$ks0;changedKs=$ks1;initialRk=$rk0;changedRk=$rk1;status="PASS"}; $wb.Close($false)

  # P0 Pass 3 bored raw: changing layer IL must change shaft lookup and Rk.
  $a=Open-Recalc "HNL_TCVN10304_Bored_Raw_P0Pass3_*.xlsx"; $wb=$a[0]
  $soil=$wb.Worksheets.Item("SOIL_PROFILE"); $calc=$wb.Worksheets.Item("CALC_TIP_RK_RD")
  $rkRow=Row-ByLabel1 $calc "Rk"; $rk0=[double]$calc.Cells.Item($rkRow,2).Value2
  $soil.Range("G2").Value2=0.3; $excel.CalculateFullRebuild(); $rk1=[double]$calc.Cells.Item($rkRow,2).Value2
  if([math]::Abs($rk1-$rk0)-lt 1e-6){throw "Bored raw đổi IL không làm Rk thay đổi"}
  $report += [pscustomobject]@{workflow="10304-bored-raw";initialRk=$rk0;changedRk=$rk1;status="PASS"}; $wb.Close($false)

  # SPT PDF Decision: shaft uses [top,bottom), boundary point belongs to deeper layer; tip point at z=tip must not enter shaft.
  $a=Open-Recalc "HNL_TCVN10304_SPT_Raw_P0Pass3_*.xlsx"; $wb=$a[0]
  $pts=$wb.Worksheets.Item("SPT_POINTS"); $tip=$wb.Worksheets.Item("CALC_TIP"); $shaft=$wb.Worksheets.Item("CALC_SHAFT"); $res=$wb.Worksheets.Item("CALC_RK_RD")
  $nRow=Row-ByLabel1 $tip "N mũi"; $rkRow=Row-ByLabel1 $res "Rk"; $qsRow=Row-ByLabel1 $res "Ru,f"
  $n0=[double]$tip.Cells.Item($nRow,2).Value2; $rk0=[double]$res.Cells.Item($rkRow,2).Value2; $qs0=[double]$res.Cells.Item($qsRow,2).Value2
  $shaftN1=[double]$shaft.Range("F2").Value2; $shaftN2=[double]$shaft.Range("F3").Value2
  if([math]::Abs($shaftN1-12.5)-gt 1e-9){throw "SPT PDF Decision layer1 expected N=12.5, got $shaftN1"}
  if([math]::Abs($shaftN2-(65.0/3.0))-gt 1e-9){throw "SPT PDF Decision deeper layer boundary allocation failed, got $shaftN2"}
  # C7 is the SPT point at depth=12 (exact pile tip): it changes tip-window mean, but shaft [6,12) must exclude it.
  $pts.Range("C7").Value2=60; $excel.CalculateFullRebuild(); $n1=[double]$tip.Cells.Item($nRow,2).Value2; $rk1=[double]$res.Cells.Item($rkRow,2).Value2; $qs1=[double]$res.Cells.Item($qsRow,2).Value2
  if([math]::Abs($n1-$n0)-lt 1e-9 -or [math]::Abs($rk1-$rk0)-lt 1e-6){throw "SPT raw thay N tại mũi không recalculation"}
  if([math]::Abs($qs1-$qs0)-gt 1e-6){throw "SPT PDF Decision: điểm tại đúng mũi bị lọt vào shaft [top,bottom)"}
  $report += [pscustomobject]@{workflow="10304-spt-raw-pdf-decision";initialN=$n0;changedN=$n1;shaftN1=$shaftN1;shaftN2=$shaftN2;initialQs=$qs0;changedQs=$qs1;initialRk=$rk0;changedRk=$rk1;status="PASS"}; $wb.Close($false)

  # P1 Material E2E: formula-only Rsoil/Rmaterial/min must recalc and be able to switch governing branch.
  $a=Open-Recalc "HNL_Pile_Capacity_Rsoil_Rmaterial_E2E_*.xlsx"; $wb=$a[0]
  $minp=$wb.Worksheets.Item("MATERIAL_INPUT"); $gov=$wb.Worksheets.Item("PILE_GOVERNING")
  $rsoil0=[double]$gov.Range("B2").Value2; $rmat0=[double]$gov.Range("B3").Value2; $rpile0=[double]$gov.Range("B4").Value2; $nd0=[double]$gov.Range("B6").Value2
  if([math]::Abs($rsoil0-2666.666666666667)-gt 1e-6){throw "P1 E2E initial Rsoil lệch: $rsoil0"}
  if([math]::Abs($rmat0-1908)-gt 1e-6 -or [math]::Abs($rpile0-1908)-gt 1e-6){throw "P1 E2E initial material governing lệch: Rmat=$rmat0 Rpile=$rpile0"}
  $asRow=Row-ByLabel1 $minp "As,tot"; $minp.Cells.Item($asRow,2).Value2=4000; $excel.CalculateFullRebuild()
  $rsoil1=[double]$gov.Range("B2").Value2; $rmat1=[double]$gov.Range("B3").Value2; $rpile1=[double]$gov.Range("B4").Value2; $nd1=[double]$gov.Range("B6").Value2
  if([math]::Abs($rsoil1-$rsoil0)-gt 1e-6){throw "P1 E2E đổi As làm thay đổi Rsoil: $rsoil0 -> $rsoil1"}
  if($rmat1 -le $rsoil1 -or [math]::Abs($rpile1-$rsoil1)-gt 1e-6){throw "P1 E2E không chuyển sang SOIL governing sau đổi As: Rsoil=$rsoil1 Rmat=$rmat1 Rpile=$rpile1"}
  if([math]::Abs($nd1-$rpile1/1.15)-gt 1e-6){throw "P1 E2E gammaN không áp dụng sau min: Nd=$nd1 Rpile=$rpile1"}
  $report += [pscustomobject]@{workflow="pile-capacity-e2e";initialRsoil=$rsoil0;initialRmaterial=$rmat0;initialRpile=$rpile0;changedRmaterial=$rmat1;changedRpile=$rpile1;initialNd=$nd0;changedNd=$nd1;status="PASS"}; $wb.Close($false)

  # P1 Pass 2 Multi-Borehole: batch summary must recalc across HK×method and all branches share one material input.
  $a=Open-Recalc "HNL_Multi_Borehole_CoLy_SPT_Rmaterial_*.xlsx"; $wb=$a[0]
  $bin=$wb.Worksheets.Item("BATCH_INPUT"); $batch=$wb.Worksheets.Item("BOREHOLE_BATCH")
  $rpRow=Row-ByLabel1 $batch "Rpile,min"; $rdRow=Row-ByLabel1 $batch "Rd,min riêng đất"; $critRow=Row-ByLabel1 $batch "HK bất lợi tổng hợp"
  $rp0=[double]$batch.Cells.Item($rpRow,2).Value2; $rd0=[double]$batch.Cells.Item($rdRow,2).Value2; $crit0=[string]$batch.Cells.Item($critRow,2).Value2
  if([math]::Abs($rp0-843.4285714285716)-gt 1e-6 -or [math]::Abs($rd0-$rp0)-gt 1e-6 -or $crit0 -ne "HK2"){throw "Multi-Borehole initial governing lệch: Rp=$rp0 Rd=$rd0 HK=$crit0"}
  $rmat0=@(); for($r=2;$r-le 7;$r++){$rmat0 += [double]$batch.Cells.Item($r,7).Value2}
  $m0=$rmat0 | Measure-Object -Minimum -Maximum
  if(($m0.Maximum - $m0.Minimum) -gt 1e-6){throw "Multi-Borehole Rmaterial ban đầu không dùng chung"}
  $asRow=Row-ByLabel1 $bin "As,tot"; $bin.Cells.Item($asRow,2).Value2=800; $excel.CalculateFullRebuild()
  $rmat1=@(); for($r=2;$r-le 7;$r++){$rmat1 += [double]$batch.Cells.Item($r,7).Value2}
  $m1=$rmat1 | Measure-Object -Minimum -Maximum
  if(($m1.Maximum - $m1.Minimum) -gt 1e-6){throw "Multi-Borehole đổi As không cập nhật Rmaterial chung cho mọi nhánh"}
  if([math]::Abs($rmat1[0]-$rmat0[0])-lt 1e-6){throw "Multi-Borehole BATCH_INPUT As không làm Rmaterial recalculation"}
  # Strengthen only HK2 mechanical sand classification; batch minimum must move from mechanical to HK2 SPT.
  $hk2m=$wb.Worksheets.Item("B02M_03_02_DIA_CHAT"); $hk2m.Range("E2:E4").Value2="coarse"; $excel.CalculateFullRebuild()
  $rp1=[double]$batch.Cells.Item($rpRow,2).Value2; $critMethodRow=Row-ByLabel1 $batch "Phương pháp bất lợi tổng hợp"; $critMethod1=[string]$batch.Cells.Item($critMethodRow,2).Value2
  if([math]::Abs($rp1-1093.3333333333335)-gt 1e-6 -or $critMethod1 -notlike "SPT*"){throw "Multi-Borehole batch không chuyển governing sau sửa HK2 mechanical: Rp=$rp1 method=$critMethod1"}
  $report += [pscustomobject]@{workflow="pile-capacity-multiborehole";initialRpile=$rp0;changedRpile=$rp1;initialHK=$crit0;changedMethod=$critMethod1;sharedMaterialBefore=$rmat0[0];sharedMaterialAfter=$rmat1[0];status="PASS"}; $wb.Close($false)

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
