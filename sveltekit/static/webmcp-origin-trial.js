(() => {
  const token = "AyS70lkje7HxRtn47nOUktZW2CE8AQp8+OfPJ7y6LS8Y9x+iujgXbSSOHQsCuvxZqn15bdBavgCtqh4u3BOcjQAAAABzeyJvcmlnaW4iOiJodHRwczovL3JlYWR5bmF6LmNvbTo0NDMiLCJmZWF0dXJlIjoiV2ViTUNQIiwiZXhwaXJ5IjoxNzk0ODczNjAwLCJpc1N1YmRvbWFpbiI6dHJ1ZSwiaXNUaGlyZFBhcnR5Ijp0cnVlfQ==";
  if (!token || document.querySelector('meta[http-equiv="origin-trial"][data-raksara-agentic]')) return;
  const meta = document.createElement('meta');
  meta.httpEquiv = 'origin-trial';
  meta.content = token;
  meta.dataset.raksaraAgentic = 'true';
  document.head.appendChild(meta);
})();
