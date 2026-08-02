$files = "attivita.html", "inserisci-dati.html", "registro-ordini.html", "inserimento-ore.html", "dashboard.html", "gestione.html", "distribuzione-ore.html", "stampa-ore.html", "admin-training.html", "chat.html", "quick-note.html", "quick-record.html", "registro-presenze.html"
$basePath = "c:\Users\fabio\Desktop\Segretario AI\Progetto_API\segretario-ai-frontend"

foreach ($file in $files) {
    $filePath = Join-Path $basePath $file
    if (Test-Path $filePath) {
        $content = Get-Content -Raw -Encoding UTF8 $filePath
        
        $content = [regex]::Replace($content, '(<a[^>]+class="header-button"[^>]*)style="[^"]*width:\s*\d+px;?[^"]*"', '$1')
        $content = [regex]::Replace($content, '(<a[^>]+class="header-button"[^>]*)style=''[^'']*width:\s*\d+px;?[^'']*''', '$1')

        $pattern = '(?si)(<a[^>]*class="header-button"[^>]*>.*?)(<img\s+[^>]+>)(.*?</a>)'
        $evaluator = [System.Text.RegularExpressions.MatchEvaluator] {
            param([System.Text.RegularExpressions.Match]$match)
            $before = $match.Groups[1].Value
            $imgTag = $match.Groups[2].Value
            $after = $match.Groups[3].Value
            
            $imgTag = [regex]::Replace($imgTag, '(?i)\s*style="[^"]*"', '')
            $imgTag = [regex]::Replace($imgTag, "(?i)\s*style='[^']*'", '')
            
            # Insert new style
            $imgTag = [regex]::Replace($imgTag, '>$', ' style="transform: rotate(180deg); filter: brightness(0) invert(1);">')
            
            return $before + $imgTag + $after
        }
        
        $content = [regex]::Replace($content, $pattern, $evaluator)
        
        Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
    }
}
