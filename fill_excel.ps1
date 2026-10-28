param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference = 'Stop'
$p = Get-Content -LiteralPath $Job -Raw -Encoding UTF8 | ConvertFrom-Json
$excel = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AutomationSecurity = 3
    $first = $excel.Workbooks.Open($p.first, 0, $true)
    $maps = @{
        'Corrected Intensities'='intensity'; 'Corrected Intensities RSDs'='rsd_i';
        'Conc. in Calib Units'='conc'; 'Conc. in Calib Units RSDs'='rsd_conc';
        'Conc. in Sample Units'='sample_conc'; 'Conc. in Sample Units RSDs'='rsd_conc'
    }
    foreach ($name in $maps.Keys) {
        $s = $first.Worksheets.Item($name)
        if ($s.Cells.Item(1,2).Text -ne 'Sample Id') { throw "Invalid template: $name" }
        $s.Range('A2:J'+[Math]::Max($s.UsedRange.Rows.Count, $p.records.Count+1)).ClearContents()
        for ($i=0; $i -lt $p.records.Count; $i++) {
            $r=$p.records[$i]; $row=$i+2
            $s.Cells.Item($row,1).Value2=[double]$r.sequence
            $s.Cells.Item($row,2).Value2=[string]$r.sample
            $s.Cells.Item($row,4).Value2=[string]$r.time
            $s.Cells.Item($row,6).Value2=[string]$r.method
            $s.Cells.Item($row,7).Value2=[string]$r.method
            $col=8
            foreach ($m in @('As','Cd','Pb')) {
                if ($s.Cells.Item(1,$col).Text -notlike "$m *") { throw 'Metal header mismatch' }
                $v=$r.metals.$m.($maps[$name])
                if ($name -eq 'Conc. in Sample Units RSDs' -and $r.sample -like 'Calib *') { $v=$null }
                if ($null -ne $v) { $s.Cells.Item($row,$col).Value2=$v }
                $col++
            }
        }
    }
    $s=$first.Worksheets.Item('Internal Standards')
    $s.Range('A2:A'+[Math]::Max($s.UsedRange.Rows.Count,$p.records.Count+1)).ClearContents()
    for($i=0;$i -lt $p.records.Count;$i++){ $s.Cells.Item($i+2,1).Value2=[double]($i+1) }
    $first.SaveAs((Join-Path $p.output 'stage1.xlsx'),51)
    $first.Close($false)
    $book=$excel.Workbooks.Open($p.second,0,$true)
    $data=$book.Worksheets.Item('DATA')
    foreach($pair in @(@('As',2),@('Cd',6),@('Pb',7))){
        $m=$pair[0];$col=$pair[1]
        if($data.Cells.Item(1,$col).Text -notlike "$m *"){throw 'DATA header mismatch'}
        $data.Cells.Item(2,$col).Value2=[double]$p.blank.metals.$m.conc
    }
    foreach($pair in @(@('As','w.As'),@('Cd','W.Cd'),@('Pb','W.Pb'))){
        $m=$pair[0];$s=$book.Worksheets.Item($pair[1])
        if($s.Cells.Item(1,1).Text -notlike "$m Standard Curve*"){throw 'Curve header mismatch'}
        # Validate native formulas before changing data. Never replace an unknown formula.
        for($row=31;$row -le 40;$row++){
            foreach($col in @(3,4,5)) { if(-not $s.Cells.Item($row,$col).HasFormula){throw "Expected formula missing: $($s.Name) row $row col $col"} }
        }
        if($p.samples.Count -ne 10){throw 'This template requires exactly 10 samples; extend the configured layout first.'}
        $s.Cells.Item(5,2).Value2=0.0
        foreach($r in $p.standards){
            $index=[int]($r.sample -replace 'Calib Std ','')
            if([Math]::Abs([double]$s.Cells.Item($index+5,1).Value2-[double]$r.metals.$m.conc) -gt 0.0000001){throw 'Calibration concentration mismatch'}
            $s.Cells.Item($index+5,2).Value2=[double]$r.metals.$m.intensity
        }
        for($i=0;$i -lt $p.samples.Count;$i++){
            if($s.Cells.Item($i+31,1).Text -ne $p.normalized[$i]){throw 'Sample row identity mismatch'}
            $s.Cells.Item($i+31,2).Value2=[double]$p.samples[$i].metals.$m.intensity
        }
    }
    # Other elements are explicitly marked as unprocessed; their historical values are not new results.
    foreach($s in $book.Worksheets){
        if($s.Name -ne 'DATA' -and $s.Name -notin @('w.As','W.Cd','W.Pb')){
            $s.Cells.Item(1,1).Value2='UNPROCESSED - no source data in this PDF'
        }
    }
    $excel.CalculateFullRebuild()
    foreach($name in @('w.As','W.Cd','W.Pb')){
        $s=$book.Worksheets.Item($name)
        for($row=31;$row -le 40;$row++){
            foreach($col in @(3,4,5)){if($s.Cells.Item($row,$col).Text -match '^#'){throw "Calculation error: $name $row"}}
        }
    }
    $book.SaveAs((Join-Path $p.output 'stage2.xls'),56)
    $book.Close($false)
} finally {
    if($null -ne $excel){$excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
}
