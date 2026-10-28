param([Parameter(Mandatory=$true)][string]$Folder)
$ErrorActionPreference='Stop'
$excel=$null
try {
    $excel=New-Object -ComObject Excel.Application
    $excel.Visible=$false;$excel.DisplayAlerts=$false;$excel.AutomationSecurity=3
    $original=$excel.Workbooks.Open((Join-Path $PSScriptRoot 'templates/metal_stage2.xlsx'),0,$true)
    $original.Worksheets.Item('w.As').ExportAsFixedFormat(0,(Join-Path $PSScriptRoot 'tmp/metal_before.pdf'))
    $original.Close($false)
    foreach($file in Get-ChildItem -LiteralPath $Folder -Filter '*.xlsx'){
        $b=$excel.Workbooks.Open($file.FullName,0,$false)
        $excel.CalculateFullRebuild()
        Write-Output ($file.Name+' sheets='+$b.Worksheets.Count)
        if($file.Name -like '*_2차.xlsx'){
            foreach($name in @('w.As','W.Cd','W.Pb')){
                $s=$b.Worksheets.Item($name)
                Write-Output ($name+' C31='+$s.Range('C31').Value2+' D31='+$s.Range('D31').Value2+' E31='+$s.Range('E31').Value2)
                foreach($address in @('C31','D31','E31','E40')){if($s.Range($address).Text -match '^#'){throw "Formula error $name $address"}}
                $s.ExportAsFixedFormat(0,(Join-Path $PSScriptRoot ('tmp/metal_after_'+$name+'.pdf')))
            }
        }
        $b.Save();$b.Close($false)
    }
}finally{if($excel){$excel.Quit()}}
