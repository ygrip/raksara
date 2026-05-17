<script lang="ts">
  import { page } from '$app/stores';

  const status = $derived($page.status ?? 404);
  const siteName = $derived((($page.data as { config?: { hero_title?: string } })?.config?.hero_title ?? 'Raksara'));

  function goBack() {
    if (history.length > 1) {
      history.back();
      return;
    }
    location.href = '/';
  }
</script>

<svelte:head>
  <title>Page Not Found - {siteName}</title>
  <meta name="description" content="The page you requested could not be found." />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="not-found-wrap">
  <section class="not-found-shell glass-heavy">
    <div class="not-found-brand">
      <span class="logo-icon"><span id="site-logo-img"></span></span>
    </div>

    <div class="not-found-illustration" aria-hidden="true">
      <svg viewBox="0 0 500 500" class="not-found-illustration-art" role="img" aria-label="404 illustration">
        <defs>
          <linearGradient id="rk404g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--gradient-1)" />
            <stop offset="100%" stop-color="var(--gradient-3)" />
          </linearGradient>
        </defs>
        <g id="OBJECTS_copia">
          <g>
            <path style="fill:url(#rk404g);" d="M195.829,287.638h-13.112v23.048h-31.762v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.112V287.638z M150.955,263.612v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.937,8.091-6.271,11.728l-13.194,19.627H150.955z"/>
            <path style="fill:url(#rk404g);" d="M290.22,251.314c0,21.067-3.53,36.5-10.587,46.301c-7.058,9.8-17.864,14.699-32.413,14.699c-14.226,0-24.949-5.116-32.17-15.352c-7.222-10.233-10.832-25.451-10.832-45.649c0-21.175,3.529-36.702,10.588-46.585c7.057-9.881,17.863-14.822,32.414-14.822c14.171,0,24.88,5.145,32.128,15.433C286.596,215.63,290.22,230.953,290.22,251.314z M236.224,251.314c0,13.466,0.841,22.723,2.525,27.772c1.682,5.049,4.506,7.574,8.47,7.574c4.017,0,6.853-2.606,8.51-7.819c1.656-5.212,2.484-14.387,2.484-27.527c0-13.193-0.842-22.438-2.524-27.731c-1.684-5.294-4.508-7.94-8.47-7.94c-3.964,0-6.788,2.553-8.47,7.655C237.065,228.402,236.224,237.74,236.224,251.314z"/>
            <path style="fill:url(#rk404g);" d="M391.289,287.638h-13.111v23.048h-31.763v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.111V287.638z M346.415,263.612v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.938,8.091-6.271,11.728l-13.193,19.627H346.415z"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="55.75" y1="218.036" x2="103.887" y2="218.036"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="115.441" y1="218.036" x2="125.717" y2="218.036"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="47.033" y1="204.488" x2="133.208" y2="204.488"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="39.94" y1="204.488" x2="32.847" y2="204.488"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="47.033" y1="191.617" x2="75.643" y2="191.617"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="83.303" y1="191.617" x2="143.388" y2="191.617"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="396.009" y1="325.524" x2="447.521" y2="325.524"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="455.899" y1="325.524" x2="463.35" y2="325.524"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="406.296" y1="311.975" x2="473.803" y2="311.975"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="401.152" y1="311.975" x2="396.009" y2="311.975"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="396.009" y1="299.104" x2="427.041" y2="299.104"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="432.595" y1="299.104" x2="455.899" y2="299.104"/>
          </g>
          <g>
            <path style="fill:none;stroke:var(--border-color);stroke-width:3.2675;stroke-miterlimit:10;" d="M201.994,287.183h-13.112v23.048h-31.762v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.112V287.183z M157.119,263.157v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.937,8.091-6.271,11.728l-13.194,19.627H157.119z"/>
            <path style="fill:none;stroke:var(--border-color);stroke-width:3.2675;stroke-miterlimit:10;" d="M296.384,250.859c0,21.067-3.53,36.5-10.587,46.301c-7.058,9.8-17.864,14.699-32.413,14.699c-14.226,0-24.949-5.116-32.17-15.352c-7.222-10.233-10.832-25.451-10.832-45.649c0-21.175,3.529-36.702,10.587-46.585c7.057-9.881,17.863-14.822,32.414-14.822c14.171,0,24.88,5.145,32.128,15.433C292.761,215.175,296.384,230.499,296.384,250.859z M242.389,250.859c0,13.466,0.841,22.723,2.525,27.772c1.682,5.049,4.506,7.574,8.47,7.574c4.017,0,6.853-2.606,8.51-7.819c1.656-5.212,2.484-14.387,2.484-27.528c0-13.193-0.842-22.438-2.524-27.731c-1.684-5.294-4.508-7.94-8.47-7.94c-3.964,0-6.788,2.553-8.47,7.655C243.23,227.947,242.389,237.286,242.389,250.859z"/>
            <path style="fill:none;stroke:var(--border-color);stroke-width:3.2675;stroke-miterlimit:10;" d="M397.454,287.183h-13.112v23.048H352.58v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.112V287.183z M352.58,263.157v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.938,8.091-6.271,11.728l-13.193,19.627H352.58z"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="418.489" y1="215.1" x2="418.489" y2="204.061"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="410.783" y1="218.292" x2="402.978" y2="210.486"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="407.592" y1="225.998" x2="396.553" y2="225.998"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="410.783" y1="233.703" x2="402.978" y2="241.509"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="418.489" y1="236.895" x2="418.489" y2="247.934"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="426.195" y1="233.703" x2="434.001" y2="241.509"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="429.387" y1="225.998" x2="440.426" y2="225.998"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="426.195" y1="218.292" x2="434.001" y2="210.486"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="72.261" y1="270.066" x2="72.261" y2="262.087"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="66.691" y1="272.374" x2="61.049" y2="266.732"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="64.384" y1="277.944" x2="56.405" y2="277.944"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="66.691" y1="283.514" x2="61.049" y2="289.156"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="72.261" y1="285.821" x2="72.261" y2="293.8"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="77.831" y1="283.514" x2="83.473" y2="289.156"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="80.138" y1="277.944" x2="88.118" y2="277.944"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="77.831" y1="272.374" x2="83.473" y2="266.732"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="288.183" y1="105.254" x2="288.183" y2="97.274"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="282.613" y1="107.561" x2="276.971" y2="101.919"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="280.306" y1="113.131" x2="272.327" y2="113.131"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="282.613" y1="118.701" x2="276.971" y2="124.343"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="288.183" y1="121.008" x2="288.183" y2="128.987"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="293.753" y1="118.701" x2="299.395" y2="124.343"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="296.06" y1="113.131" x2="304.039" y2="113.131"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="293.753" y1="107.561" x2="299.395" y2="101.919"/>
          </g>
          <rect x="111.874" y="326.894" style="fill:none;stroke:var(--accent);stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" width="273.761" height="43.098"/>
          <polyline style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" points="133.208,172.198 133.208,137.669 312.701,137.669 312.701,214.389"/>
          <polyline style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" points="249.436,113.131 249.436,156.361 368.464,156.361 368.464,176.029"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M137.491,176.481c0,2.366-1.918,4.283-4.283,4.283c-2.366,0-4.283-1.918-4.283-4.283c0-2.365,1.918-4.283,4.283-4.283C135.574,172.198,137.491,174.115,137.491,176.481z"/>
          <circle style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" cx="249.436" cy="108.848" r="4.283"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M372.747,180.764c0,2.365-1.918,4.283-4.283,4.283c-2.366,0-4.283-1.918-4.283-4.283c0-2.366,1.918-4.283,4.283-4.283C370.829,176.481,372.747,178.399,372.747,180.764z"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M316.984,219.383c0,2.365-1.918,4.283-4.283,4.283s-4.283-1.918-4.283-4.283c0-2.366,1.918-4.283,4.283-4.283S316.984,217.018,316.984,219.383z"/>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="105.295" y1="305.164" x2="95.161" y2="315.298"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="95.161" y1="305.164" x2="105.295" y2="315.298"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="110.362" y1="158" x2="100.228" y2="168.135"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="100.228" y1="158" x2="110.362" y2="168.135"/>
          </g>
          <g>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="439.068" y1="272.876" x2="428.933" y2="283.011"/>
            <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="428.933" y1="272.876" x2="439.068" y2="283.011"/>
          </g>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M151.47,100.161c-3.232,0-6.19,1.163-8.487,3.089c-2.346-7.062-8.994-12.16-16.843-12.16c-8.787,0-16.065,6.389-17.487,14.771c-0.926-0.265-1.901-0.416-2.913-0.416c-5.843,0-10.579,4.737-10.579,10.579c0,5.375,4.012,9.803,9.202,10.48v0.1h47.107c7.302,0,13.222-5.919,13.222-13.222C164.692,106.081,158.772,100.161,151.47,100.161z"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M396.605,167.417c2.348,0,4.497,0.845,6.166,2.244c1.704-5.13,6.534-8.834,12.236-8.834c6.384,0,11.671,4.642,12.704,10.731c0.673-0.193,1.381-0.302,2.116-0.302c4.245,0,7.686,3.441,7.686,7.686c0,3.905-2.914,7.122-6.685,7.613v0.072h-34.222c-5.305,0-9.605-4.301-9.605-9.605S391.3,167.417,396.605,167.417z"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M443.789,349.113c-1.969,0-3.771,0.709-5.171,1.882c-1.429-4.302-5.48-7.409-10.262-7.409c-5.354,0-9.788,3.893-10.654,9c-0.564-0.161-1.158-0.253-1.775-0.253c-3.56,0-6.446,2.886-6.446,6.446c0,3.275,2.444,5.973,5.607,6.385v0.061h28.7c4.449,0,8.056-3.606,8.056-8.055C451.844,352.72,448.238,349.113,443.789,349.113z"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" d="M54.253,332.114c2.348,0,4.497,0.845,6.166,2.244c1.704-5.13,6.534-8.834,12.236-8.834c6.384,0,11.671,4.642,12.704,10.731c0.673-0.193,1.381-0.302,2.116-0.302c4.245,0,7.686,3.441,7.686,7.686c0,3.905-2.914,7.122-6.685,7.613v0.072H54.253c-5.305,0-9.605-4.3-9.605-9.605C44.648,336.414,48.948,332.114,54.253,332.114z"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:3.2675,7.6242;opacity:0.7" d="M164.692,93.818c0,0,60.44-49.277,142.56-26.575C393.515,91.09,410.783,152.6,410.783,152.6"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:3.0467,7.1089;opacity:0.7" d="M73.433,237.04c-23.431,3.634-35.21,53.363-8.854,73.104"/>
          <path style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:3.2675,7.6242;opacity:0.7" d="M368.464,380.526c0,0,40.138,17.546,57.732-6.933"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="177.513" y1="180.764" x2="177.513" y2="155.418"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="171.395" y1="180.764" x2="171.395" y2="168.135"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="270.67" y1="186.628" x2="270.67" y2="168.091"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="263.72" y1="185.047" x2="263.72" y2="177.359"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="257.554" y1="185.047" x2="257.554" y2="172.198"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="183.394" y1="180.764" x2="183.394" y2="168.091"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="351.395" y1="184.292" x2="351.395" y2="178.622"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="345.277" y1="184.292" x2="345.277" y2="170.482"/>
          <line style="fill:none;stroke:var(--accent);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;opacity:0.7" x1="357.276" y1="184.292" x2="357.276" y2="174.428"/>
        </g>
      </svg>
    </div>

    <h1>{status === 404 ? 'That page does not exist.' : 'Something went wrong.'}</h1>
    <p>The requested URL could not be resolved. Return to the main site or go back to the previous page.</p>

    <div class="not-found-actions">
      <a class="not-found-home" href="/">Go home</a>
      <button class="not-found-back" type="button" onclick={goBack}>Go back</button>
    </div>
  </section>
</main>

<style>
  .not-found-wrap {
    min-height: calc(100vh - 120px);
    display: grid;
    place-items: center;
    padding: 28px;
  }

  .not-found-shell {
    width: min(680px, 100%);
    padding: 40px;
    border-radius: 28px;
    border: 1px solid var(--border-color);
    box-shadow: 0 24px 80px var(--shadow-color);
    text-align: left;
  }

  .not-found-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .not-found-brand .logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--accent);
  }

  .not-found-illustration {
    width: min(420px, 85vw);
    margin: 0 auto 28px;
  }

  .not-found-illustration-art {
    width: 100%;
    height: auto;
    display: block;
  }

  h1 {
    margin: 0 0 12px;
    font-size: clamp(2rem, 5vw, 3.1rem);
    line-height: 1.06;
    color: var(--text-primary);
  }

  p {
    margin: 0 0 24px;
    color: var(--text-secondary);
    font-size: 1.02rem;
  }

  .not-found-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .not-found-actions a,
  .not-found-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 18px;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.98rem;
  }

  .not-found-home {
    background: var(--accent);
    color: #fff;
  }

  .not-found-home:hover {
    filter: brightness(1.05);
  }

  .not-found-back {
    border-color: var(--border-color);
    color: var(--text-primary);
    background: transparent;
  }

  .not-found-back:hover {
    background: var(--bg-hover);
  }

  @media (max-width: 640px) {
    .not-found-shell {
      padding: 28px;
    }

    .not-found-illustration {
      width: min(260px, 76vw);
    }
  }
</style>
