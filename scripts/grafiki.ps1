# =====================================================================
#  GRAFIKI STRONY — przygotowanie logo i obrazka do social mediów
#
#  Uruchomienie (w folderze projektu):
#      powershell -ExecutionPolicy Bypass -File scripts\grafiki.ps1
#
#  Robi dwie rzeczy:
#   1. logo-k24h.png  — zmniejsza logo do rozmiaru, w jakim faktycznie jest
#      pokazywane (2x dla ekranów Retina). Oryginał (471x600, 161 kB) był
#      ~40x większy niż potrzeba i spowalniał wczytywanie strony.
#   2. og-k24h.png    — obrazek 1200x630, który pokazuje się przy
#      udostępnianiu linku na Facebooku i w reklamach.
#
#  Oryginał logo leży w assets-zrodla\logo-k24h-oryginal.png
# =====================================================================

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$zrodlo = Join-Path $root "assets-zrodla\logo-k24h-oryginal.png"
$public = Join-Path $root "public"

if (-not (Test-Path $zrodlo)) {
  Write-Error "Brak pliku zrodlowego: $zrodlo"
  exit 1
}

# --- kolory marki ---
$tlo    = [System.Drawing.Color]::FromArgb(19, 17, 15)      # --ink
$zloto  = [System.Drawing.Color]::FromArgb(201, 168, 106)   # --vein
$krem   = [System.Drawing.Color]::FromArgb(236, 230, 218)   # --cream
$szary  = [System.Drawing.Color]::FromArgb(140, 132, 116)   # --dim

# ---------------------------------------------------------- 1. LOGO
$org = [System.Drawing.Image]::FromFile($zrodlo)
$wysokosc = 108                                              # 54 px * 2 (Retina)
$szerokosc = [int][math]::Round($org.Width * ($wysokosc / $org.Height))

$logo = New-Object System.Drawing.Bitmap $szerokosc, $wysokosc
$g = [System.Drawing.Graphics]::FromImage($logo)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($org, 0, 0, $szerokosc, $wysokosc)
$g.Dispose()

$celLogo = Join-Path $public "logo-k24h.png"
$logo.Save($celLogo, [System.Drawing.Imaging.ImageFormat]::Png)
$logo.Dispose()
"OK  logo-k24h.png       $szerokosc x $wysokosc px, $([math]::Round((Get-Item $celLogo).Length/1KB)) kB (wyswietlane jako $([int]($szerokosc/2)) x 54)"

# ------------------------------------------------------------ 2. OG
$ogW = 1200; $ogH = 630
$og = New-Object System.Drawing.Bitmap $ogW, $ogH
$g = [System.Drawing.Graphics]::FromImage($og)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$g.Clear($tlo)

# delikatna zlota poswiata w prawym gornym rogu
$sciezka = New-Object System.Drawing.Drawing2D.GraphicsPath
$sciezka.AddEllipse(760, -260, 760, 760)
$pedzel = New-Object System.Drawing.Drawing2D.PathGradientBrush $sciezka
$pedzel.CenterColor = [System.Drawing.Color]::FromArgb(46, 201, 168, 106)
$pedzel.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 201, 168, 106))
$g.FillPath($pedzel, $sciezka)
$pedzel.Dispose(); $sciezka.Dispose()

# zlota ramka
$pioro = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 201, 168, 106)), 2
$g.DrawRectangle($pioro, 28, 28, $ogW - 57, $ogH - 57)
$pioro.Dispose()

# logo w lewym gornym rogu
$orgLogo = [System.Drawing.Image]::FromFile($zrodlo)
$lh = 132; $lw = [int][math]::Round($orgLogo.Width * ($lh / $orgLogo.Height))
$g.DrawImage($orgLogo, 74, 66, $lw, $lh)
$orgLogo.Dispose()

# teksty
$fEyebrow = New-Object System.Drawing.Font "Arial", 15, ([System.Drawing.FontStyle]::Bold)
$fH1      = New-Object System.Drawing.Font "Georgia", 60, ([System.Drawing.FontStyle]::Regular)
$fH1kurs  = New-Object System.Drawing.Font "Georgia", 60, ([System.Drawing.FontStyle]::Italic)
$fSub     = New-Object System.Drawing.Font "Georgia", 23, ([System.Drawing.FontStyle]::Regular)
$fTel     = New-Object System.Drawing.Font "Arial", 30, ([System.Drawing.FontStyle]::Bold)
$fMale    = New-Object System.Drawing.Font "Arial", 14, ([System.Drawing.FontStyle]::Regular)

$bZloto = New-Object System.Drawing.SolidBrush $zloto
$bKrem  = New-Object System.Drawing.SolidBrush $krem
$bSzary = New-Object System.Drawing.SolidBrush $szary

$g.DrawString("KAMIENIARSTWO 24H  ·  TARNOBRZEG", $fEyebrow, $bSzary, 74, 232)
$g.DrawString("Wyceń blat kuchenny", $fH1, $bKrem, 68, 268)
$g.DrawString("w kilka pytań.", $fH1kurs, $bZloto, 68, 348)
$g.DrawString("Konglomerat kwarcowy, spiek i kamień naturalny.", $fSub, $bSzary, 74, 442)

# pasek na dole
$bPasek = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 27, 24, 21))
$g.FillRectangle($bPasek, 29, 508, $ogW - 58, 92)
$g.DrawString("796 991 128", $fTel, $bZloto, 70, 528)
$g.DrawString("Bezpłatny pomiar  ·  własny zakład  ·  ul. Szpitalna 8", $fMale, $bSzary, 74, 570)

$celOg = Join-Path $public "og-k24h.png"
$og.Save($celOg, [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($o in @($fEyebrow,$fH1,$fH1kurs,$fSub,$fTel,$fMale,$bZloto,$bKrem,$bSzary,$bPasek,$g,$og,$org)) { $o.Dispose() }

"OK  og-k24h.png         $ogW x $ogH px, $([math]::Round((Get-Item $celOg).Length/1KB)) kB"
