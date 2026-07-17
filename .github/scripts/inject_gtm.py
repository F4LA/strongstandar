import glob
import re

GTM_HEAD = """<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WHG7DNVZ');</script>
<!-- End Google Tag Manager -->"""

GTM_BODY = """<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WHG7DNVZ"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->"""

for path in glob.glob('./**/*.html', recursive=True):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    if 'GTM-WHG7DNVZ' in content:
        print(f'Skipping (already has GTM): {path}')
        continue

    original = content
    content = content.replace('</head>', GTM_HEAD + '\n</head>', 1)
    content = re.sub(r'(<body[^>]*>)', r'\1\n' + GTM_BODY, content, count=1)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Injected GTM: {path}')
    else:
        print(f'No head/body found: {path}')
