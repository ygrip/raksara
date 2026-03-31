  // ── Share ───────────────────────────────────────────────

  function shareButton(title) {
    return `<button class="share-btn" aria-label="Share">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Share</span>
    </button>`;
  }

  function loadImageCors(url) {
    if (_imgCache[url]) return Promise.resolve(_imgCache[url]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timeout = setTimeout(() => {
        img.src = "";
        reject();
      }, 2000);
      img.onload = () => {
        clearTimeout(timeout);
        _imgCache[url] = img;
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject();
      };
      img.src = url;
    });
  }

  function canvasWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (const word of words) {
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (maxLines && lines.length >= maxLines - 1) {
          lines.push(line + "\u2026");
          line = "";
          break;
        }
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (let i = 0; i < lines.length; i++)
      ctx.fillText(lines[i], x, y + i * lineHeight);
    return lines.length;
  }

  function canvasRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function createLogoImage(color) {
    return new Promise((resolve, reject) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -10 124 120" fill="${color}" stroke="${color}"><path d="M50 8 L8 50 L50 92 L92 50" stroke-width="10" stroke-linejoin="miter" stroke-linecap="butt" fill="none"/><path d="M 50 8 L 68 26" stroke-width="10" stroke-linecap="butt" fill="none"/><rect x="52" y="45" width="40" height="10" stroke="none"/><path d="M 35 22 C 22 8, 6 -2, -8 -4 C -4 4, 10 18, 26 32 Z" stroke="none"/><path d="M 26 68 C 10 84, -4 96, -8 104 C 4 96, 18 82, 35 78 Z" stroke="none"/></svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
  }

  function canvasFolderIcon(ctx, x, y, size, color) {
    const w = size,
      h = size * 0.78;
    const tabW = w * 0.38,
      tabH = h * 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + tabW, y - h);
    ctx.lineTo(x + tabW + tabH, y - h + tabH);
    ctx.lineTo(x + w, y - h + tabH);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  function canvasSeparator(ctx, x1, x2, y) {
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  async function generateShareImage(title, opts) {
    const {
      coverUrl,
      author,
      readTime,
      summary,
      isDirectory,
      pageCount,
      pageLabel,
      category,
      tags,
      dirPostTitles,
      isProfile,
      avatarUrl,
      role,
      socials,
      isGallery,
      galleryImageUrls,
      galleryCount,
      isThoughts,
      isPortfolioDetail,
    } = opts || {};
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const S = 1080;
    canvas.width = S;
    canvas.height = S;
    const cs = getComputedStyle(document.documentElement);
    const accent1 = cs.getPropertyValue("--gradient-1").trim() || "#6366f1";
    const accent2 = cs.getPropertyValue("--gradient-2").trim() || "#8b5cf6";

    let coverImg = null,
      logoImg = null,
      avatarImg = null;
    const galleryImgs = [];
    const loads = [
      createLogoImage(accent1)
        .then((i) => {
          logoImg = i;
        })
        .catch(() => {}),
    ];
    if (coverUrl)
      loads.push(
        loadImageCors(coverUrl)
          .then((i) => {
            coverImg = i;
          })
          .catch(() => {}),
      );
    if (isProfile && avatarUrl)
      loads.push(
        loadImageCors(avatarUrl)
          .then((i) => {
            avatarImg = i;
          })
          .catch(() => {}),
      );
    if (isGallery && galleryImageUrls) {
      galleryImageUrls.slice(0, 4).forEach((url, idx) => {
        loads.push(
          loadImageCors(url)
            .then((img) => {
              galleryImgs[idx] = img;
            })
            .catch(() => {}),
        );
      });
    }
    loads.push(
      Promise.race([
        document.fonts.load('700 52px "Inter"'),
        new Promise((r) => setTimeout(r, 500)),
      ]),
    );
    await Promise.all(loads);

    if (coverImg) {
      const thumbS = 128;
      const tc = document.createElement("canvas");
      tc.width = thumbS;
      tc.height = thumbS;
      const tctx = tc.getContext("2d");
      const ts = Math.max(thumbS / coverImg.width, thumbS / coverImg.height);
      tctx.filter = "blur(4px) brightness(0.32)";
      tctx.drawImage(
        coverImg,
        (thumbS - coverImg.width * ts) / 2,
        (thumbS - coverImg.height * ts) / 2,
        coverImg.width * ts,
        coverImg.height * ts,
      );
      tctx.filter = "none";
      ctx.drawImage(tc, 0, 0, S, S);
    } else {
      const bg = ctx.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, "#0f0f1a");
      bg.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 0.18;
      const o1 = ctx.createRadialGradient(
        S * 0.25,
        S * 0.2,
        0,
        S * 0.25,
        S * 0.2,
        S * 0.4,
      );
      o1.addColorStop(0, accent1);
      o1.addColorStop(1, "transparent");
      ctx.fillStyle = o1;
      ctx.fillRect(0, 0, S, S);
      const o2 = ctx.createRadialGradient(
        S * 0.82,
        S * 0.75,
        0,
        S * 0.82,
        S * 0.75,
        S * 0.35,
      );
      o2.addColorStop(0, accent1);
      o2.addColorStop(1, "transparent");
      ctx.fillStyle = o2;
      ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 1;
    }

    const mg = 56,
      cardW = S - mg * 2,
      cardH = S - mg * 2,
      cardR = 18;
    const barW = 5,
      pad = 44;
    const footerH = 130,
      footerTop = mg + cardH - footerH;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 8;
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.stroke();

    ctx.save();
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.clip();
    ctx.fillStyle = accent1;
    ctx.fillRect(mg, mg, barW, cardH);
    ctx.restore();

    const useWhiteFooter =
      !isProfile && !isThoughts && !isGallery && !isDirectory;
    ctx.save();
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.clip();
    if (useWhiteFooter) {
      ctx.fillStyle = "#f2f2f5";
      ctx.fillRect(mg, footerTop, cardW, footerH);
    } else if (coverImg) {
      const fs = Math.max(
        cardW / coverImg.width,
        (footerH * 2) / coverImg.height,
      );
      ctx.filter = "blur(4px) brightness(0.35)";
      ctx.drawImage(
        coverImg,
        mg + (cardW - coverImg.width * fs) / 2,
        footerTop + (footerH - coverImg.height * fs) / 2,
        coverImg.width * fs,
        coverImg.height * fs,
      );
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(mg, footerTop, cardW, footerH);
    } else {
      const fg = ctx.createLinearGradient(
        mg,
        footerTop,
        mg + cardW,
        footerTop + footerH,
      );
      fg.addColorStop(0, "#1a1a2e");
      fg.addColorStop(1, "#12122a");
      ctx.fillStyle = fg;
      ctx.fillRect(mg, footerTop, cardW, footerH);
      ctx.globalAlpha = 0.2;
      const fo = ctx.createRadialGradient(
        mg + cardW * 0.3,
        footerTop + footerH / 2,
        0,
        mg + cardW * 0.3,
        footerTop + footerH / 2,
        250,
      );
      fo.addColorStop(0, accent1);
      fo.addColorStop(1, "transparent");
      ctx.fillStyle = fo;
      ctx.fillRect(mg, footerTop, cardW, footerH);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = useWhiteFooter
      ? "rgba(0,0,0,0.10)"
      : "rgba(255,255,255,0.5)";
    ctx.lineWidth = useWhiteFooter ? 1 : 2.5;
    ctx.beginPath();
    ctx.moveTo(mg + barW, footerTop);
    ctx.lineTo(mg + cardW, footerTop);
    ctx.stroke();
    ctx.restore();

    const cx = mg + barW + pad,
      cr = mg + cardW - pad;
    const ct = mg + pad,
      cw = cr - cx;
    const centerX = (cx + cr) / 2;
    const fcx = mg + barW + pad,
      fcr = mg + cardW - pad;
    const fcy = footerTop + footerH / 2;
    const siteName = (state.config && state.config.hero_title) || "Raksara";

    if (isProfile) {
      const coverH = cardH - footerH + mg;
      ctx.save();
      canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
      ctx.clip();
      if (coverImg) {
        const cvs = Math.max(cardW / coverImg.width, coverH / coverImg.height);
        ctx.filter = "blur(4px) brightness(0.4)";
        ctx.drawImage(
          coverImg,
          mg + (cardW - coverImg.width * cvs) / 2,
          mg + (coverH - coverImg.height * cvs) / 2,
          coverImg.width * cvs,
          coverImg.height * cvs,
        );
        ctx.filter = "none";
      } else {
        const cvg = ctx.createLinearGradient(mg, mg, mg + cardW, mg + coverH);
        cvg.addColorStop(0, "#1a1a2e");
        cvg.addColorStop(1, "#12122a");
        ctx.fillStyle = cvg;
        ctx.fillRect(mg, mg, cardW, coverH);
      }
      ctx.restore();

      const panelTop = mg + 260;
      const panelH = footerTop - panelTop;
      ctx.save();
      canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
      ctx.clip();
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = -4;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      canvasRoundRect(ctx, mg + barW, panelTop, cardW - barW, panelH, 16);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      canvasRoundRect(ctx, mg + barW, panelTop, cardW - barW, panelH, 16);
      ctx.stroke();
      ctx.restore();

      const aSize = 200;
      const aCy = panelTop - 10;
      if (avatarImg) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(centerX, aCy, aSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, aCy, aSize / 2, 0, Math.PI * 2);
        ctx.clip();
        const aS = Math.max(aSize / avatarImg.width, aSize / avatarImg.height);
        ctx.drawImage(
          avatarImg,
          centerX - (avatarImg.width * aS) / 2,
          aCy - (avatarImg.height * aS) / 2,
          avatarImg.width * aS,
          avatarImg.height * aS,
        );
        ctx.restore();
      }

      const nameY = aCy + aSize / 2 + 48;
      ctx.textAlign = "center";
      ctx.font = '700 42px "Inter", system-ui, sans-serif';
      const nameM = ctx.measureText(title || "");
      const nhPad = 18,
        nvPad = 10;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      canvasRoundRect(
        ctx,
        centerX - nameM.width / 2 - nhPad,
        nameY - 34 - nvPad,
        nameM.width + nhPad * 2,
        44 + nvPad * 2,
        10,
      );
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(title || "", centerX, nameY);

      let curProfileY = nameY;

      if (role) {
        curProfileY += 44;
        ctx.font = "500 20px Inter, -apple-system, sans-serif";
        const roleM = ctx.measureText(role);
        const rhPad = 14,
          rvPad = 7;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        canvasRoundRect(
          ctx,
          centerX - roleM.width / 2 - rhPad,
          curProfileY - 16 - rvPad,
          roleM.width + rhPad * 2,
          24 + rvPad * 2,
          8,
        );
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(role, centerX, curProfileY);
      }

      curProfileY += 38;
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 60, curProfileY);
      ctx.lineTo(cr - 60, curProfileY);
      ctx.stroke();

      const metadata = opts.metadata;
      if (metadata && metadata.length) {
        curProfileY += 24;
        ctx.textAlign = "left";
        const chipX = cx + 20;
        const chipMaxW = cw - 40;
        const cPadH = 20,
          cPadV = 11,
          cH = 22 + cPadV * 2,
          cR = cH / 2;
        for (const item of metadata.slice(0, 3)) {
          ctx.font = "700 17px Inter, -apple-system, sans-serif";
          const lblW = ctx.measureText(item.label).width;
          let fullW = lblW;
          let sepW = 0,
            valText = item.value || "";
          if (valText) {
            ctx.font = "400 17px Inter, -apple-system, sans-serif";
            sepW = ctx.measureText("  :  ").width;
            ctx.font = "500 17px Inter, -apple-system, sans-serif";
            fullW = lblW + sepW + ctx.measureText(valText).width;
            const maxInner = chipMaxW - cPadH * 2;
            if (fullW > maxInner) {
              const valMaxW = maxInner - lblW - sepW;
              while (
                ctx.measureText(valText).width > valMaxW &&
                valText.length > 1
              )
                valText = valText.slice(0, -1);
              if (valText.length < item.value.length) valText += "\u2026";
            }
            fullW = lblW + sepW + ctx.measureText(valText).width;
          }
          const chipW = Math.min(fullW + cPadH * 2, chipMaxW);

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.12)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = "rgba(40,40,50,0.75)";
          canvasRoundRect(ctx, chipX, curProfileY, chipW, cH, cR);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, chipX, curProfileY, chipW, cH, cR);
          ctx.stroke();

          const tY = curProfileY + cH / 2 + 6;
          ctx.font = "700 17px Inter, -apple-system, sans-serif";
          ctx.fillStyle = "#fff";
          ctx.fillText(item.label, chipX + cPadH, tY);
          if (item.value) {
            const lW = ctx.measureText(item.label).width;
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.font = "400 17px Inter, -apple-system, sans-serif";
            ctx.fillText("  :  ", chipX + cPadH + lW, tY);
            const sW = ctx.measureText("  :  ").width;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "500 17px Inter, -apple-system, sans-serif";
            ctx.fillText(valText, chipX + cPadH + lW + sW, tY);
          }
          curProfileY += cH + 10;
        }
      }
      ctx.textAlign = "left";

      if (logoImg) {
        const lh = 28,
          lw = lh * (logoImg.width / logoImg.height);
        ctx.font = "600 20px Inter, -apple-system, sans-serif";
        const snw = ctx.measureText(siteName).width;
        const totalW = lw + 10 + snw;
        const lx = centerX - totalW / 2;
        ctx.drawImage(logoImg, lx, fcy - lh / 2 + 2, lw, lh);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(siteName, lx + lw + 10, fcy + 8);
      }
    } else {
      const hasCover = !!coverImg;
      const maxCoverH = Math.floor(cardH * 0.25);
      const coverH = hasCover ? maxCoverH : 0;
      if (hasCover) {
        ctx.save();
        canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(mg, mg, cardW, coverH);
        ctx.clip();
        const cvs = Math.max(cardW / coverImg.width, coverH / coverImg.height);
        ctx.filter = "blur(2px)";
        ctx.drawImage(
          coverImg,
          mg + (cardW - coverImg.width * cvs) / 2,
          mg + (coverH - coverImg.height * cvs) / 2,
          coverImg.width * cvs,
          coverImg.height * cvs,
        );
        ctx.filter = "none";
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(mg, mg, cardW, coverH);
        ctx.restore();
      }

      const contentTop = mg + coverH + pad;
      let curY = contentTop;

      ctx.fillStyle = "#111";
      ctx.font = '700 54px "Inter", system-ui, sans-serif';
      const rawTitleLines = [];
      {
        const words = (title || "").split(" ");
        let line = "";
        for (const word of words) {
          const test = line + (line ? " " : "") + word;
          if (ctx.measureText(test).width > cw - 20 && line) {
            if (rawTitleLines.length >= 2) {
              rawTitleLines.push(line + "\u2026");
              line = "";
              break;
            }
            rawTitleLines.push(line);
            line = word;
          } else line = test;
        }
        if (line)
          rawTitleLines.push(
            rawTitleLines.length >= 3 ? line.slice(0, -1) + "\u2026" : line,
          );
      }
      const tLh = 68;
      if (hasCover) {
        for (let i = 0; i < rawTitleLines.length; i++) {
          const tw = ctx.measureText(rawTitleLines[i]).width;
          const hlPad = 10;
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          canvasRoundRect(
            ctx,
            cx - hlPad,
            curY - 4 + i * tLh,
            tw + hlPad * 2,
            tLh - 4,
            6,
          );
          ctx.fill();
        }
      }
      ctx.fillStyle = "#111";
      ctx.font = '700 54px "Inter", system-ui, sans-serif';
      for (let i = 0; i < rawTitleLines.length; i++)
        ctx.fillText(rawTitleLines[i], cx, curY + 48 + i * tLh);
      curY += rawTitleLines.length * tLh + 12;

      const hasSummary = !!summary;
      const hasChips = !!(category || (tags && tags.length));

      if (hasSummary) {
        canvasSeparator(ctx, cx, cr, curY);
        curY += 18;
        ctx.fillStyle = "#444";
        ctx.font = "400 22px Inter, -apple-system, sans-serif";
        const sumLines = canvasWrapText(ctx, summary, cx, curY, cw, 32, 4);
        curY += sumLines * 32 + 10;
      }

      if (hasChips) {
        const chipLabels = [];
        if (category) chipLabels.push(category);
        if (tags && tags.length) {
          for (const t of tags) {
            if (t !== category && chipLabels.length < 4) chipLabels.push(t);
          }
        }
        curY += 8;
        let chipX = cx;
        ctx.font = "600 15px Inter, -apple-system, sans-serif";
        for (const label of chipLabels) {
          const tw = ctx.measureText(label).width;
          const cW = tw + 24,
            cH = 32,
            cR = 7;
          if (chipX + cW > cr) break;
          ctx.fillStyle = "#f0f0f4";
          canvasRoundRect(ctx, chipX, curY, cW, cH, cR);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.06)";
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, chipX, curY, cW, cH, cR);
          ctx.stroke();
          ctx.fillStyle = accent1;
          ctx.fillText(label, chipX + 12, curY + 22);
          chipX += cW + 8;
        }
        curY += 40;
      }

      if (readTime && !isPortfolioDetail) {
        ctx.fillStyle = "#aaa";
        ctx.font = "500 15px Inter, -apple-system, sans-serif";
        ctx.fillText(readTime + " min read", cx, curY + 12);
        curY += 28;
      }

      const isDetailPage = !isDirectory && !isGallery && !isThoughts;
      if (isDetailPage && author) {
        const aPadH = 16,
          aPadV = 10,
          aFh = 18;
        ctx.font = "600 " + aFh + "px Inter, -apple-system, sans-serif";
        const aText = "by  " + author;
        const aTw = ctx.measureText(aText).width;
        const aW = aTw + aPadH * 2,
          aH = aFh + aPadV * 2,
          aR = aH / 2;
        const aX = fcx,
          aY = fcy - aH / 2;
        ctx.fillStyle = "rgba(40,40,50,0.82)";
        canvasRoundRect(ctx, aX, aY, aW, aH, aR);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(aText, aX + aPadH, aY + aPadV + aFh - 3);
      }

      if (isDetailPage && logoImg) {
        const lh = 22,
          lw = lh * (logoImg.width / logoImg.height);
        ctx.font = "600 16px Inter, -apple-system, sans-serif";
        const snw = ctx.measureText(siteName).width;
        const chipW = lw + 10 + snw + 28,
          chipH = 38,
          chipR = chipH / 2;
        const chipX = fcr - chipW,
          chipY = fcy - chipH / 2;
        ctx.fillStyle = "rgba(40,40,50,0.82)";
        canvasRoundRect(ctx, chipX, chipY, chipW, chipH, chipR);
        ctx.fill();
        ctx.drawImage(logoImg, chipX + 14, chipY + (chipH - lh) / 2, lw, lh);
        ctx.fillStyle = "#fff";
        ctx.fillText(siteName, chipX + 14 + lw + 8, fcy + 6);
      }

      if (isPortfolioDetail) {
        const availH = footerTop - curY - 10;
        const aSize = Math.min(availH, 260);
        const aCx = centerX,
          aCy = curY + availH / 2;
        const abbrev = (title || "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 6;
        const abGrad = ctx.createLinearGradient(
          aCx - aSize / 2,
          aCy - aSize / 2,
          aCx + aSize / 2,
          aCy + aSize / 2,
        );
        abGrad.addColorStop(0, accent1);
        abGrad.addColorStop(1, accent2);
        ctx.fillStyle = abGrad;
        canvasRoundRect(
          ctx,
          aCx - aSize / 2,
          aCy - aSize / 2,
          aSize,
          aSize,
          36,
        );
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.font =
          "bold " +
          Math.round(aSize * 0.45) +
          "px Inter, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(abbrev || "P", aCx, aCy + Math.round(aSize * 0.16));
        ctx.textAlign = "left";
      } else if (isThoughts) {
        const availH = footerTop - curY - 40;
        const bCx = centerX,
          bCy = curY + 16 + availH * 0.4;
        const bW = 380,
          bH = 260,
          bR = 32;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.10)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        canvasRoundRect(ctx, bCx - bW / 2, bCy - bH / 2, bW, bH, bR);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.10)";
        ctx.lineWidth = 2;
        canvasRoundRect(ctx, bCx - bW / 2, bCy - bH / 2, bW, bH, bR);
        ctx.stroke();
        const dotY = bCy + bH / 2 + 24;
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        ctx.beginPath();
        ctx.arc(bCx - 24, dotY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bCx - 58, dotY + 30, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        for (let i = 0; i < 4; i++) {
          const lw = bW * (0.75 - i * 0.12);
          canvasRoundRect(
            ctx,
            bCx - lw / 2,
            bCy - bH / 2 + 48 + i * 36,
            lw,
            14,
            7,
          );
          ctx.fill();
        }
        ctx.textAlign = "center";
        ctx.fillStyle = "#777";
        ctx.font = "500 24px Inter, -apple-system, sans-serif";
        ctx.fillText(
          "Random ideas that pop in my mind",
          bCx,
          bCy + bH / 2 + 80,
        );
        ctx.textAlign = "left";
        if (logoImg) {
          const lh = 28,
            lw = lh * (logoImg.width / logoImg.height);
          ctx.font = "600 20px Inter, -apple-system, sans-serif";
          const snw = ctx.measureText(siteName).width;
          const totalW = lw + 10 + snw;
          const lx = centerX - totalW / 2;
          ctx.drawImage(logoImg, lx, fcy - lh / 2 + 2, lw, lh);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillText(siteName, lx + lw + 10, fcy + 8);
        }
      } else if (isGallery) {
        const imgs = galleryImgs.filter(Boolean);
        const gridCount = Math.min(imgs.length, 4);
        if (gridCount) {
          const mGap = 14,
            mR = 10;
          const gridAvailH = footerTop - curY - 10;
          const mH = Math.floor((gridAvailH - mGap) / 2);
          const mW = mH;
          const gridTotalW = mW * 2 + mGap;
          const gridStartX = cx + (cw - gridTotalW) / 2;
          const mStartY = curY + 10;
          ctx.save();
          ctx.beginPath();
          ctx.rect(mg, mg, cardW, footerTop - mg);
          canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
          ctx.clip();
          for (let i = 0; i < 4; i++) {
            const col = i % 2,
              row = Math.floor(i / 2);
            const mx = gridStartX + col * (mW + mGap);
            const my = mStartY + row * (mH + mGap);
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.10)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1;
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.stroke();
            if (i < gridCount) {
              ctx.save();
              canvasRoundRect(ctx, mx, my, mW, mH, mR);
              ctx.clip();
              const img = imgs[i];
              const iScale = Math.max(mW / img.width, mH / img.height);
              ctx.drawImage(
                img,
                mx + (mW - img.width * iScale) / 2,
                my + (mH - img.height * iScale) / 2,
                img.width * iScale,
                img.height * iScale,
              );
              ctx.restore();
            }
          }
          ctx.restore();
        }
        const gCount = galleryCount || 0;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 28px Inter, -apple-system, sans-serif";
        ctx.fillText(
          gCount + " photo" + (gCount !== 1 ? "s" : ""),
          fcx,
          fcy + 11,
        );
      } else if (isDirectory) {
        canvasSeparator(ctx, cx, cr, curY + 8);
        const titles = dirPostTitles || [];
        const mGap = 14,
          mR = 10;
        const gridAvailH = footerTop - curY - 24;
        const mH = Math.floor((gridAvailH - mGap) / 2);
        const mW = mH;
        const gridTotalW = mW * 2 + mGap;
        const gridStartX = cx + (cw - gridTotalW) / 2;
        const mStartY = curY + 24;
        ctx.save();
        ctx.beginPath();
        ctx.rect(mg, mg, cardW, footerTop - mg);
        canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
        ctx.clip();
        for (let i = 0; i < 4; i++) {
          const col = i % 2,
            row = Math.floor(i / 2);
          const mx = gridStartX + col * (mW + mGap);
          const my = mStartY + row * (mH + mGap);
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.08)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          canvasRoundRect(ctx, mx, my, mW, mH, mR);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "rgba(255,255,255,0.4)";
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, mx, my, mW, mH, mR);
          ctx.stroke();
          if (i < titles.length) {
            ctx.save();
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.clip();
            ctx.fillStyle = accent1;
            ctx.fillRect(mx, my, mW, 5);
            ctx.restore();
            ctx.fillStyle = "#333";
            ctx.font = "bold 18px Inter, -apple-system, sans-serif";
            canvasWrapText(
              ctx,
              titles[i] || "",
              mx + 14,
              my + 30,
              mW - 28,
              24,
              2,
            );
            ctx.fillStyle = "rgba(0,0,0,0.07)";
            for (let l = 0; l < 3; l++) {
              canvasRoundRect(
                ctx,
                mx + 14,
                my + 82 + l * 18,
                mW * (0.65 - l * 0.1),
                8,
                4,
              );
              ctx.fill();
            }
          }
        }
        ctx.restore();
        const label = pageLabel || "post";
        canvasFolderIcon(ctx, fcx, fcy + 14, 38, "rgba(255,255,255,0.9)");
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px Inter, -apple-system, sans-serif";
        ctx.fillText(
          pageCount + " " + label + (pageCount !== 1 ? "s" : ""),
          fcx + 52,
          fcy + 11,
        );
      }
    }

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  const _imgCache = {};
  function prefetchImage(url) {
    if (!url || _imgCache[url]) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      _imgCache[url] = img;
    };
    img.src = url;
  }

  function initShareButton(title, opts) {
    const btn = document.querySelector(".share-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const url = window.location.href;
      const label = btn.querySelector("span");
      const origText = label ? label.textContent : "";
      if (label) label.textContent = "Generating...";
      try {
        if (navigator.share) {
          const shareData = { title, text: title, url };
          try {
            const testFile = new File([""], "t.png", { type: "image/png" });
            if (
              navigator.canShare &&
              navigator.canShare({ files: [testFile] })
            ) {
              const resolvedAuthor =
                (opts && opts.author) ||
                (state.config && state.config.author) ||
                "";
              const blob = await generateShareImage(title, {
                ...opts,
                author: resolvedAuthor,
              });
              if (blob)
                shareData.files = [
                  new File([blob], "share.png", { type: "image/png" }),
                ];
            }
          } catch {}
          if (label) label.textContent = origText;
          try {
            await navigator.share(shareData);
          } catch {}
          return;
        }
        try {
          const resolvedAuthor =
            (opts && opts.author) ||
            (state.config && state.config.author) ||
            "";
          const blob = await generateShareImage(title, {
            ...opts,
            author: resolvedAuthor,
          });
          const items = [
            new ClipboardItem({
              "text/plain": new Blob([title ? `${title} : ${url}` : url], {
                type: "text/plain",
              }),
              ...(blob ? { "image/png": blob } : {}),
            }),
          ];
          await navigator.clipboard.write(items);
          if (label) label.textContent = "Copied!";
          setTimeout(() => {
            if (label) label.textContent = origText;
          }, 2000);
        } catch {
          try {
            await navigator.clipboard.writeText(
              title ? `${title} : ${url}` : url,
            );
            if (label) label.textContent = "Copied!";
            setTimeout(() => {
              if (label) label.textContent = origText;
            }, 2000);
          } catch {}
        }
      } finally {
        if (label && label.textContent === "Generating...")
          label.textContent = origText;
      }
    });
  }

  // ── Image Lightbox in Articles ────────────────────────

  async function loadMermaidIfNeeded() {
    const mermaidBlocks = document.querySelectorAll(
      ".language-mermaid, .mermaid",
    );

    if (mermaidBlocks.length === 0) {
      return;
    }

    // Dynamically load mermaid only when needed
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    
    script.onload = () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
      });

      mermaidBlocks.forEach((block) => {
        let container;

        if (block.classList.contains("language-mermaid")) {
          // markdown code block
          container = document.createElement("div");
          container.className = "mermaid";
          container.textContent = block.textContent;

          block.parentElement.replaceWith(container);
        }
      });

      mermaid.run();
    };

    document.head.appendChild(script);
  }

  function initCodeBlocks() {
    document.querySelectorAll(".article-body pre").forEach((pre) => {
      if (pre.parentElement.classList.contains("code-block-wrap")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrap";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      const code = pre.querySelector("code");
      const codeText = code ? code.textContent || "" : pre.textContent || "";
      const lineCount = codeText ? codeText.split(/\r?\n/).length : 0;
      const isLong = lineCount > 18 || codeText.length > 1100;
      if (isLong) {
        wrapper.classList.add("is-collapsed");
        const fade = document.createElement("div");
        fade.className = "code-fade";
        wrapper.appendChild(fade);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "code-toggle-btn";
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Expand code";
        toggle.addEventListener("click", () => {
          const expanded = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
          wrapper.classList.toggle("is-collapsed", expanded);
          toggle.textContent = expanded ? "Expand code" : "Collapse code";
        });
        wrapper.appendChild(toggle);
      }
      const btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.title = "Copy code";
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        const text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(() => {
          btn.classList.add("copied");
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
          }, 2000);
        });
      });
      wrapper.appendChild(btn);
    });
  }

  function initVideoPlayers() {
    document.querySelectorAll(".article-body a.video-player").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const img = a.querySelector("img");
      const title = img ? img.alt || "" : a.getAttribute("data-title") || "";
      const src = img ? img.src : "";
      const thumbSrc = src || a.getAttribute("data-thumbnail") || "";
      if (!thumbSrc) return;
      const player = document.createElement("div");
      player.className = "video-player";
      player.addEventListener("click", () => window.open(href, "_blank"));
      player.innerHTML = `
        <img ${buildDetailImageAttrs(thumbSrc, {
          alt: title,
          loading: "lazy",
        })}>
        <div class="video-player-overlay">
          <div class="video-player-play">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          ${title ? `<div class="video-player-title">${escapeHtml(title)}</div>` : ""}
        </div>`;
      a.replaceWith(player);
    });
  }

  async function initArticleImages() {
    const codeNodes = Array.from(document.querySelectorAll(".article-body pre code"));
    if (codeNodes.length) {
      const langs = new Set();
      for (const el of codeNodes) {
        const cls = Array.from(el.classList).find((c) => c.startsWith("language-"));
        const lang = cls ? cls.slice("language-".length) : "plaintext";
        langs.add(normalizeHighlightLanguage(lang));
      }

      try {
        await ensureHighlightCoreLoaded();
        await Promise.all(Array.from(langs).map((l) => ensureHighlightLanguageLoaded(l)));
        if (highlightState.instance) {
          codeNodes.forEach((el) => {
            const langClass = Array.from(el.classList).find((c) => c.startsWith("language-"));
            const rawLang = langClass ? langClass.slice("language-".length) : "plaintext";
            const normalized = normalizeHighlightLanguage(rawLang);
            if (!highlightState.instance.getLanguage(normalized)) {
              if (langClass) el.classList.remove(langClass);
              el.classList.add("language-plaintext");
            }
            highlightState.instance.highlightElement(el);
          });
        }
      } catch {
        // ensureHighlightCoreLoaded already tries local then CDN; if both fail, leave code plain.
      }
    }

    initCodeBlocks();
    loadMermaidIfNeeded();
    initVideoPlayers();
    document.querySelectorAll(".article-body img").forEach((img) => {
      if (img.closest(".video-player")) return;
      img.addEventListener("click", () => openLightbox(img.src, img.alt));
    });
    initLazyImages();
    initFileAttachments();
    initProgressBars();
    initCharts();
  }

  let _carouselImages = [];
  let _carouselIndex = 0;
  let _carouselTransitionToken = 0;

  function preloadCarouselImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          if (typeof img.decode === "function") await img.decode();
        } catch {
          // Ignore decode errors and continue with loaded bitmap.
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  function openLightbox(src, caption) {
    _carouselImages = [];
    _carouselIndex = 0;
    _carouselTransitionToken += 1;
    const lb = document.getElementById("lightbox");
    const content = lb.querySelector(".lightbox-content");
    content
      .querySelectorAll(".lightbox-nav, .lightbox-dots")
      .forEach((el) => el.remove());
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox-caption").textContent = caption || "";
    lb.classList.remove("hidden");
  }

  function openCarousel(images, startIndex) {
    _carouselImages = images;
    _carouselIndex = startIndex || 0;
    _carouselTransitionToken += 1;
    const lb = document.getElementById("lightbox");
    const content = lb.querySelector(".lightbox-content");
    content
      .querySelectorAll(".lightbox-nav, .lightbox-dots")
      .forEach((el) => el.remove());
    const current = images[_carouselIndex];
    document.getElementById("lightbox-img").src = resolvePath(current.src);
    document.getElementById("lightbox-caption").textContent =
      current.caption || "";

    // Preload adjacent slides for smoother next/prev transitions.
    if (images.length > 1) {
      const prev = images[(_carouselIndex - 1 + images.length) % images.length];
      const next = images[(_carouselIndex + 1) % images.length];
      if (prev && prev.src) preloadCarouselImage(resolvePath(prev.src));
      if (next && next.src) preloadCarouselImage(resolvePath(next.src));
    }
    if (images.length > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "lightbox-nav prev";
      prevBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateCarousel(-1);
      });
      const nextBtn = document.createElement("button");
      nextBtn.className = "lightbox-nav next";
      nextBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateCarousel(1);
      });
      content.appendChild(prevBtn);
      content.appendChild(nextBtn);
      const dots = document.createElement("div");
      dots.className = "lightbox-dots";
      images.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className =
          "lightbox-dot" + (i === _carouselIndex ? " active" : "");
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          goToCarouselSlide(i);
        });
        dots.appendChild(dot);
      });
      content.appendChild(dots);
    }
    lb.classList.remove("hidden");
  }

  function navigateCarousel(dir) {
    if (_carouselImages.length < 2) return;
    _carouselIndex =
      (_carouselIndex + dir + _carouselImages.length) % _carouselImages.length;
    updateCarouselSlide();
  }

  function goToCarouselSlide(index) {
    _carouselIndex = index;
    updateCarouselSlide();
  }

  async function updateCarouselSlide() {
    const current = _carouselImages[_carouselIndex];
    if (!current) return;

    const img = document.getElementById("lightbox-img");
    const nextSrc = resolvePath(current.src);
    const token = ++_carouselTransitionToken;

    img.style.opacity = "0";
    await preloadCarouselImage(nextSrc);
    if (token !== _carouselTransitionToken) return;

    img.src = nextSrc;
    document.getElementById("lightbox-caption").textContent =
      current.caption || "";

    requestAnimationFrame(() => {
      if (token !== _carouselTransitionToken) return;
      img.style.opacity = "1";
    });

    // Keep near slides warm in cache during carousel navigation.
    if (_carouselImages.length > 1) {
      const prev = _carouselImages[
        (_carouselIndex - 1 + _carouselImages.length) % _carouselImages.length
      ];
      const next = _carouselImages[(_carouselIndex + 1) % _carouselImages.length];
      if (prev && prev.src) preloadCarouselImage(resolvePath(prev.src));
      if (next && next.src) preloadCarouselImage(resolvePath(next.src));
    }

    document.querySelectorAll(".lightbox-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === _carouselIndex);
    });
  }

  function closeLightbox() {
    const lb = document.getElementById("lightbox");
    lb.classList.add("hidden");
    document.getElementById("lightbox-img").src = "";
    _carouselImages = [];
    _carouselIndex = 0;
    _carouselTransitionToken += 1;
    lb.querySelector(".lightbox-content")
      .querySelectorAll(".lightbox-nav, .lightbox-dots")
      .forEach((el) => el.remove());
  }

  window.__openLightbox = openLightbox;

  window.__openGallery = function (galleryIndex) {
    const g = state.gallery[galleryIndex];
    if (!g) return;
    const images = getGalleryImages(g);
    if (!images.length) return;
    if (images.length === 1) {
      openLightbox(resolvePath(images[0].src), images[0].caption || g.caption);
    } else {
      openCarousel(images, 0);
    }
  };