const box = document.getElementById('io');

  box.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
    
    let md = html
      .replace(/<h1.*?>(.*?)<\/h1>/gmi, '# $1\n')
      .replace(/<h2.*?>(.*?)<\/h2>/gmi, '## $1\n')
      .replace(/<h3.*?>(.*?)<\/h3>/gmi, '### $1\n')
      .replace(/<(strong|b).*?>(.*?)<\/\1>/gmi, '**$2**')
      .replace(/<(em|i).*?>(.*?)<\/\1>/gmi, '_$2_')
      .replace(/<a.*?href="(.*?)".*?>(.*?)<\/a>/gmi, '[$2]($1)')
      .replace(/<p.*?>(.*?)<\/p>/gmi, '$1\n\n')
      .replace(/<br.*?>/gmi, '\n')
      .replace(/<[^>]+>/g, '') // Strip remaining tags
      .replace(/&nbsp;/g, ' ')
      .trim();

    box.value = md;
  });

  box.addEventListener('click', () => {
    if (box.value) {
      box.select();
      document.execCommand('copy');
      const original = box.style.borderColor;
      box.style.borderColor = '#4CAF50';
      setTimeout(() => box.style.borderColor = original, 1000);
    }
  });