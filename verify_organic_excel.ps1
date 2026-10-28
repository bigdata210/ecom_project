param([Parameter(Mandatory=$true)][string]$Result)
$ErrorActionPreference='Stop'
$excel=$null
try {
    $excel=New-Object -ComObject Excel.Application
    $excel.Visible=$false; $excel.DisplayAlerts=$false; $excel.AutomationSecurity=3
    $original=$excel.Workbooks.Open((Join-Path $PSScriptRoot 'templates/organic_template.xlsx'),0,$true)
    $original.Worksheets.Item('Diazinon').ExportAsFixedFormat(0,(Join-Path $PSScriptRoot 'tmp/organic_before.pdf'))
    $original.Close($false)
    $book=$excel.Workbooks.Open($Result,0,$false)
    $excel.CalculateFullRebuild()
    $log=@()
    foreach($s in $book.Worksheets){
        $log+=($s.Name+' charts='+$s.ChartObjects().Count+' E30='+$s.Range('E30').Text+' H30='+$s.Range('H30').Text)
        foreach($address in @('K29','M29','E30','E31','E32','E33','E34')){
            $cell=$s.Range($address)
            if($cell.Text -match '^#(REF!|DIV/0!|VALUE!|NAME\?|NUM!|N/A)'){throw "Formula error: $($s.Name) $address"}
        }
        $s.PageSetup.Zoom=$false; $s.PageSetup.FitToPagesWide=1; $s.PageSetup.FitToPagesTall=1
    }
    $book.Save()
    $book.ExportAsFixedFormat(0,(Join-Path $PSScriptRoot 'tmp/organic_after.pdf'))
    $book.Close($false)
    $log
} finally {if($null -ne $excel){$excel.Quit()}}
