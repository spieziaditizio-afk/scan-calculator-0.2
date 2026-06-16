# Pallet QR Ingest & Relabel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Optimize mode scan a pallet's QR label to bulk-load its boxes, then after a pick is confirmed, remove those boxes from the pallet's stored state and reprint an updated QR label so the rack-posted label always matches what physically remains.

**Architecture:** Everything lives in the single existing `<script>` block of `index.html` (per `CLAUDE.md` — no new files, no build step). A vendored, vetted QR encoder (Kazuhiko Arase's `qrcode-generator`, MIT licensed) is inlined verbatim to render QR codes as inline SVG for the print iframe. The pallet data model gains a `meta` field (present, possibly blank, on every pallet — manual or QR-ingested) so any pallet can produce a re-scannable QR label. Scan routing in Optimize gains a highest-priority `PC\d+|` branch that parses and validates the QR payload before falling through to the existing rack/box logic. A new "Confirm pick" action removes picked boxes from their pallets and reprints affected labels.

**Tech Stack:** Vanilla JS (inline `<script>`), inline SVG for print output, `localStorage` for persistence — no new dependencies, no CDN, no build tooling.

---

## File Structure

Single file, `index.html`. No new files are created. Within it:

- **QR encoder (new code, ~Task 1):** a vendored third-party library (`qrcode`) plus one small wrapper (`palletQrSvg`), inserted right after `"use strict";` at the top of the existing `<script>` block. Self-contained; nothing else in the file depends on its internals beyond calling `palletQrSvg(str)`.
- **Pallet data model (modify, ~Task 2):** `newPallet()` gains optional `boxes`/`meta` params; two new pure helpers `palletMeta(p)` and `palletQrPayload(p)` live next to it.
- **QR ingest (new code, ~Task 3):** `ingestPalletQr(raw)` lives next to `handleOptScan`, which gains a one-line highest-priority branch that calls it.
- **Print layout (modify, ~Task 4):** `printCss()` gains a few new label-layout classes; `printPallet(id)` is rewritten to render the PN/PLT header, the QR, a pieces-per-box chip list, and a totals row.
- **Confirm pick (new code, ~Task 5):** `confirmPick(sol)` lives next to `printPallet`; `renderPick()` gains a second button that calls it.

Each task only depends on the ones before it (1 → 2 → 3, 2 → 4, 1+2+4 → 5), so they must be done in order.

---

### Task 1: Inline the QR encoder library

**Files:**
- Modify: `index.html:463` (insert after this line)

The QR payload uses `|` and `,`, which aren't in the QR "alphanumeric" charset, so byte-mode encoding is required. Rather than hand-writing a Reed-Solomon QR encoder (high risk of a subtly-wrong, hard-to-detect bug — a label that looks fine on screen but won't scan), this task vendors the actual `qrcode-generator` library (Kazuhiko Arase, MIT license — the exact library named in the approved design spec) and adds one wrapper function. The library exposes `qrcode(typeNumber, errorCorrectionLevel)`; passing `typeNumber=0` auto-picks the smallest QR version that fits the data, and `qr.createSvgTag({scalable:true})` returns a self-contained `<svg>...</svg>` string (no external refs) — exactly what the print iframe needs, since it's a separate document and can't use the main document's icon sprite.

- [ ] **Step 1: Insert the vendored library + wrapper into `index.html`**

  Open `index.html` and find line 463:
  ```js
  "use strict";
  ```
  Immediately after that line, insert the following block (the full vendored library, followed by a one-line charset override and the wrapper function). This is the complete, unmodified core of `qrcode-generator` v2.0.4 (MIT licensed) with only its trailing UMD/CommonJS wrapper removed, since this is a plain inline `<script>`, not a module:

  ```js
  /* ---------- vendored: qrcode-generator v2.0.4, Kazuhiko Arase, MIT license ---------- */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  function palletQrSvg(str){
    const qr = qrcode(0, 'M');
    qr.addData(str);
    qr.make();
    return qr.createSvgTag({ cellSize:4, margin:4, scalable:true });
  }
  /* ---------- end vendored qrcode-generator ---------- */
  ```

- [ ] **Step 2: Syntax-check the script**

  Run (PowerShell, from the project root):
  ```
  $l=Get-Content index.html; $s=($l|Select-String '^<script>'|Select-Object -First 1).LineNumber; $e=($l|Select-String '^</script>'|Select-Object -First 1).LineNumber; $l[$s..($e-2)]|Set-Content tmp.js -Encoding utf8; node --check tmp.js; Remove-Item tmp.js
  ```
  Expected: no output (clean syntax check).

- [ ] **Step 3: Verify the encoder with a temp Node script**

  Create a temp file `qr_task1_test.js` containing the exact library text you just inserted (copy lines between `/* ---------- vendored` and `/* ---------- end vendored` from `index.html`, minus those two comment lines) followed by:
  ```js
  const assert = require('assert');
  const svg = palletQrSvg('PC1|1|SEVENUM|PO123|DEL1|US|20,10,100,100');
  assert(svg.startsWith('<svg'), 'should produce an SVG string');
  assert(svg.includes('viewBox'), 'should include a viewBox');
  const svgBlank = palletQrSvg('PC1||||||20,10,100,100');
  assert(svgBlank.startsWith('<svg'), 'should encode blank-identity manual pallet payload too');
  console.log('Task 1 tests passed');
  ```
  Run: `node qr_task1_test.js`
  Expected: `Task 1 tests passed`. Then delete the temp file.

- [ ] **Step 4: Commit**

  ```bash
  git add index.html
  git commit -m "feat: vendor qrcode-generator library for pallet label QR encoding"
  ```

---

### Task 2: Pallet data model — `meta` field

**Files:**
- Modify: `index.html:599-602` (`newPallet`)
- Modify: `index.html:603` (insert after `ensurePallet`)

Every pallet — manually built or QR-ingested — needs a `meta` field so any pallet can later produce a valid, re-scannable QR label. `newPallet` currently only takes a `rack`; it gains two optional params (`boxes`, `meta`) so both creation paths (manual scan-to-build, and QR bulk-ingest in Task 3) share one function instead of duplicating ID-generation/naming logic.

- [ ] **Step 1: Replace `newPallet`**

  Find in `index.html`:
  ```js
  function newPallet(rack){
    const p={ id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name:'Pallet '+(pallets.length+1), rack:rack||'', boxes:[] };
    pallets.push(p); activeId=p.id; saveOpt(); return p;
  }
  ```
  Replace with:
  ```js
  function newPallet(rack, boxes, meta){
    const p={
      id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      name:(meta&&meta.pn)||('Pallet '+(pallets.length+1)),
      rack:rack||'',
      boxes:boxes||[],
      meta:meta||{ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''}
    };
    pallets.push(p); activeId=p.id; saveOpt(); return p;
  }
  ```
  (Existing call sites — `newPallet($('in-orack').value.trim())` in `ensurePallet()` and `newPallet('')` on the `op-newpallet` button — keep working unchanged: `boxes`/`meta` default to `[]`/blank meta.)

- [ ] **Step 2: Add `palletMeta` and `palletQrPayload` helpers**

  Immediately after `function ensurePallet(){ return activePallet() || newPallet($('in-orack').value.trim()); }`, insert:
  ```js
  function palletMeta(p){ return p.meta || {ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''}; }
  function palletQrPayload(p){
    const m=palletMeta(p);
    const qtys=p.boxes.slice().sort((a,b)=>a.seq-b.seq).map(b=>b.pieces).join(',');
    return [m.ver||'PC1', m.palletId, m.pn, m.po, m.delivery, m.coo, qtys].join('|');
  }
  ```
  `palletMeta` is the single read path used everywhere `meta` is needed — it defaults to a blank object for pallets saved before this feature shipped (no migration needed, matches the approved spec). `palletQrPayload` re-encodes a pallet's *current* box state back into the `PC1|...` string format, sorted by `seq` so box numbering on a reprinted label is stable.

- [ ] **Step 3: Syntax-check the script**

  Run the same PowerShell one-liner as Task 1, Step 2. Expected: no output.

- [ ] **Step 4: Verify with a temp Node script**

  Create `qr_task2_test.js`:
  ```js
  let pallets = [];
  let activeId = null;
  const store = { set(){} };
  const saveOpt = ()=>{ store.set(); };
  function newPallet(rack, boxes, meta){
    const p={ id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name:(meta&&meta.pn)||('Pallet '+(pallets.length+1)), rack:rack||'', boxes:boxes||[], meta:meta||{ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''} };
    pallets.push(p); activeId=p.id; saveOpt(); return p;
  }
  function palletMeta(p){ return p.meta || {ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''}; }
  function palletQrPayload(p){
    const m=palletMeta(p);
    const qtys=p.boxes.slice().sort((a,b)=>a.seq-b.seq).map(b=>b.pieces).join(',');
    return [m.ver||'PC1', m.palletId, m.pn, m.po, m.delivery, m.coo, qtys].join('|');
  }

  const assert = require('assert');
  const manual = newPallet('CG35071601');
  assert.strictEqual(manual.name, 'Pallet 1');
  assert.deepStrictEqual(manual.meta, {ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''});
  assert.strictEqual(palletQrPayload(manual), 'PC1||||||');

  const qrPallet = newPallet('', [{seq:1,pieces:20},{seq:2,pieces:10}], {ver:'PC1',palletId:'1',pn:'SEVENUM',po:'PO123',delivery:'DEL1',coo:'US'});
  assert.strictEqual(qrPallet.name, 'SEVENUM');
  assert.strictEqual(palletQrPayload(qrPallet), 'PC1|1|SEVENUM|PO123|DEL1|US|20,10');

  const legacy = { boxes:[{seq:1,pieces:5}] };
  assert.deepStrictEqual(palletMeta(legacy), {ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''});
  assert.strictEqual(palletQrPayload(legacy), 'PC1||||||5');

  console.log('Task 2 tests passed');
  ```
  Run: `node qr_task2_test.js`
  Expected: `Task 2 tests passed`. Then delete the temp file.

- [ ] **Step 5: Commit**

  ```bash
  git add index.html
  git commit -m "feat: add meta field to pallet data model for QR identity"
  ```

---

### Task 3: QR ingest parsing + scan routing

**Files:**
- Modify: `index.html:950-967` (`handleOptScan`, insert new function before it)

A scan starting with `PC<digits>|` is a pallet QR, not a rack or box code. This always creates a brand-new pallet (QR data is never merged into an existing one) unless the exact same pallet was already loaded, in which case it just re-activates it.

- [ ] **Step 1: Add `ingestPalletQr`**

  Immediately before `function handleOptScan(raw){` (`index.html:950`), insert:
  ```js
  function ingestPalletQr(raw){
    const parts = raw.split('|');
    if(parts.length!==7 || !/^PC\d+$/.test(parts[0])){ flash('Invalid pallet QR'); return; }
    const [ver,palletId,pn,po,delivery,coo,qtyStr] = parts;
    const qtys = qtyStr.split(',').map(cleanToPieces);
    if(qtys.some(v=>v==null)){ flash('Invalid pallet QR'); return; }
    const sig = ver+'|'+palletId+'|'+pn+'|'+po+'|'+delivery;
    const existing = pallets.find(p=>{ const m=palletMeta(p); return (m.ver+'|'+m.palletId+'|'+m.pn+'|'+m.po+'|'+m.delivery)===sig; });
    if(existing){ activeId=existing.id; $('in-orack').value=existing.rack||''; saveOpt(); render(); flash('Pallet already loaded'); return; }
    const boxes = qtys.map((pieces,i)=>({seq:i+1,pieces}));
    newPallet('', boxes, {ver,palletId,pn,po,delivery,coo});
    $('in-orack').value='';
    render();
    flash(activePallet().name+' loaded — '+boxes.length+' boxes',true);
  }
  ```

- [ ] **Step 2: Wire it into `handleOptScan` as the highest-priority branch**

  Find:
  ```js
  function handleOptScan(raw){
    if(isDup(raw)) return;
    const rack=asRack(raw);
  ```
  Replace with:
  ```js
  function handleOptScan(raw){
    if(isDup(raw)) return;
    if(/^PC\d+\|/.test(raw)){ ingestPalletQr(raw); return; }
    const rack=asRack(raw);
  ```
  (Everything below this — the existing rack and box-piece branches — is unchanged. Box codes and rack codes never contain `|`, so there's no collision between the three branches.)

- [ ] **Step 3: Syntax-check the script**

  Run the same PowerShell one-liner as Task 1, Step 2. Expected: no output.

- [ ] **Step 4: Verify with a temp Node script**

  Create `qr_task3_test.js`:
  ```js
  let pallets = [];
  let activeId = null;
  function cleanToPieces(raw){
    const digits = String(raw==null?'':raw).replace(/\D/g,'');
    if(!digits) return null;
    const n = parseInt(digits,10);
    return (Number.isFinite(n) && n>0) ? n : null;
  }
  function newPallet(rack, boxes, meta){
    const p={ id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name:(meta&&meta.pn)||('Pallet '+(pallets.length+1)), rack:rack||'', boxes:boxes||[], meta:meta||{ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''} };
    pallets.push(p); activeId=p.id; return p;
  }
  function activePallet(){ return pallets.find(p=>p.id===activeId)||null; }
  function palletMeta(p){ return p.meta || {ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''}; }
  let flashed=[];
  function flash(msg){ flashed.push(msg); }
  const orackEl = { value: '' };
  function $(id){ return id==='in-orack' ? orackEl : null; }
  function saveOpt(){}
  function render(){}

  function ingestPalletQr(raw){
    const parts = raw.split('|');
    if(parts.length!==7 || !/^PC\d+$/.test(parts[0])){ flash('Invalid pallet QR'); return; }
    const [ver,palletId,pn,po,delivery,coo,qtyStr] = parts;
    const qtys = qtyStr.split(',').map(cleanToPieces);
    if(qtys.some(v=>v==null)){ flash('Invalid pallet QR'); return; }
    const sig = ver+'|'+palletId+'|'+pn+'|'+po+'|'+delivery;
    const existing = pallets.find(p=>{ const m=palletMeta(p); return (m.ver+'|'+m.palletId+'|'+m.pn+'|'+m.po+'|'+m.delivery)===sig; });
    if(existing){ activeId=existing.id; $('in-orack').value=existing.rack||''; saveOpt(); render(); flash('Pallet already loaded'); return; }
    const boxes = qtys.map((pieces,i)=>({seq:i+1,pieces}));
    newPallet('', boxes, {ver,palletId,pn,po,delivery,coo});
    $('in-orack').value='';
    render();
    flash(activePallet().name+' loaded — '+boxes.length+' boxes',true);
  }

  const assert = require('assert');

  ingestPalletQr('PC1|1|SEVENUM|PO123|DEL1|US|20,10,100,100');
  assert.strictEqual(pallets.length, 1);
  assert.strictEqual(pallets[0].name, 'SEVENUM');
  assert.deepStrictEqual(pallets[0].boxes, [{seq:1,pieces:20},{seq:2,pieces:10},{seq:3,pieces:100},{seq:4,pieces:100}]);
  assert.strictEqual(activeId, pallets[0].id);

  const firstId = pallets[0].id;
  activeId = null;
  ingestPalletQr('PC1|1|SEVENUM|PO123|DEL1|US|20,10,100,100');
  assert.strictEqual(pallets.length, 1, 'must not duplicate an already-loaded pallet');
  assert.strictEqual(activeId, firstId, 'must re-activate the existing pallet');
  assert.ok(flashed.includes('Pallet already loaded'));

  flashed=[];
  ingestPalletQr('PC1|1|SEVENUM|PO123|DEL1|US');
  assert.strictEqual(pallets.length, 1, 'malformed QR must not ingest');
  assert.ok(flashed.includes('Invalid pallet QR'));

  flashed=[];
  ingestPalletQr('PC1|2|OTHER|PO9|DEL9|US|20,abc,10');
  assert.strictEqual(pallets.length, 1, 'invalid quantities must not ingest');
  assert.ok(flashed.includes('Invalid pallet QR'));

  const manual = newPallet('CG35071601');
  assert.deepStrictEqual(palletMeta(manual), {ver:'PC1',palletId:'',pn:'',po:'',delivery:'',coo:''});

  console.log('Task 3 tests passed');
  ```
  Run: `node qr_task3_test.js`
  Expected: `Task 3 tests passed`. Then delete the temp file.

- [ ] **Step 5: Commit**

  ```bash
  git add index.html
  git commit -m "feat: parse pallet QR scans into new pallets with dedup guard"
  ```

---

### Task 4: Label print layout (QR + PN/PLT header)

**Files:**
- Modify: `index.html:813-831` (`printCss`)
- Modify: `index.html:885-893` (`printPallet`)

This upgrades the existing per-pallet "Print" button (Board view) so every pallet — manual or QR-ingested — prints a label mirroring the receiving label's layout: PN/PLT header, QR top-right, pieces-per-box chips, totals row, footer.

- [ ] **Step 1: Add new CSS classes to `printCss()`**

  Find:
  ```js
     .chip.pull{background:#000;color:#fff;}
     .foot{margin-top:2mm;font-size:${small?'7pt':'9pt'};color:#000;}
    `;
  }
  ```
  Replace with:
  ```js
     .chip.pull{background:#000;color:#fff;}
     .lblhead{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;margin:0 0 2mm;}
     .qrbox{flex:0 0 auto;}
     .qrbox svg{display:block;width:${small?'18mm':'28mm'};height:${small?'18mm':'28mm'};}
     .lsec{font-weight:800;margin:1mm 0 1mm;border-bottom:.5pt solid #000;padding-bottom:.5mm;}
     .totrow{display:flex;justify-content:space-between;font-weight:800;border-top:1pt solid #000;border-bottom:1pt solid #000;padding:1mm 0;margin:1mm 0 2mm;}
     .foot{margin-top:2mm;font-size:${small?'7pt':'9pt'};color:#000;}
    `;
  }
  ```

- [ ] **Step 2: Rewrite `printPallet`**

  Find:
  ```js
  function printPallet(id){
    const p=pallets.find(x=>x.id===id); if(!p||!p.boxes.length){ flash('Empty pallet'); return; }
    const t=p.boxes.reduce((a,b)=>a+b.pieces,0);
    let inner='<div class="h1">BOX CHIP — '+esc(p.name)+'</div>'
      +'<div class="meta"><b>Rack:</b> '+esc(p.rack||'—')+' &nbsp; <b>'+p.boxes.length+'</b> boxes · <b>'+fmt(t)+'</b> pieces</div>'
      +'<div class="chips">'+p.boxes.slice().sort((a,b)=>a.seq-b.seq).map(b=>pchip(b.seq,b.pieces,false)).join('')+'</div>'
      +'<div class="foot">'+stamp()+'</div>';
    doPrint(inner);
  }
  ```
  Replace with:
  ```js
  function printPallet(id){
    const p=pallets.find(x=>x.id===id); if(!p||!p.boxes.length){ flash('Empty pallet'); return; }
    const m=palletMeta(p);
    const sortedBoxes=p.boxes.slice().sort((a,b)=>a.seq-b.seq);
    const t=sortedBoxes.reduce((a,b)=>a+b.pieces,0);
    const qrSvg=palletQrSvg(palletQrPayload(p));
    let inner='<div class="lblhead"><div><div class="h1">PACKCALC · '+esc(m.pn||'—')+'</div>'
      +(m.palletId?'<div class="h1" style="margin-top:-1mm">PLT '+esc(m.palletId)+'</div>':'')
      +'</div><div class="qrbox">'+qrSvg+'</div></div>'
      +'<div class="meta"><b>Rack:</b> '+esc(p.rack||'—')+'</div>'
      +'<div class="lsec">PIECES PER BOX</div>'
      +'<div class="chips">'+sortedBoxes.map(b=>pchip(b.seq,b.pieces,false)).join('')+'</div>'
      +'<div class="totrow"><span>TOTAL BOXES '+sortedBoxes.length+'</span><span>TOTAL PIECES '+fmt(t)+'</span></div>'
      +'<div class="foot">'+esc(p.name)+' · '+stamp()+' · QLn420</div>';
    doPrint(inner);
  }
  ```
  (The Board view's existing `data-printpallet` click handler at `index.html:970` already calls `printPallet(id)` for any pallet — no change needed there; every pallet now gets the upgraded label automatically, manual ones included since `palletMeta` defaults to blank identity fields, omitting the `PLT` line.)

- [ ] **Step 3: Syntax-check the script**

  Run the same PowerShell one-liner as Task 1, Step 2. Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add index.html
  git commit -m "feat: render QR + PN/PLT header on printed pallet labels"
  ```

---

### Task 5: Confirm pick → remove → relabel

**Files:**
- Modify: `index.html:751-780` (`renderPick`)
- Modify: `index.html:885-893` area (insert `confirmPick` after `printPallet`)

Adds a "Confirm pick" button next to "Print picking mix". Tapping it removes the picked boxes from their pallets, deletes any pallet that hits zero boxes, and reprints the updated label for every pallet that still has boxes left — chained 1200ms apart so each print job finishes before the next overwrites the shared print iframe.

- [ ] **Step 1: Add `confirmPick`**

  Immediately after the `printPallet` function (the one just rewritten in Task 4), insert:
  ```js
  function confirmPick(sol){
    if(!sol||!sol.picks.length){ flash('Nothing to pick'); return; }
    const byPal=new Map();
    for(const b of sol.picks){ if(!byPal.has(b.palletId)) byPal.set(b.palletId,[]); byPal.get(b.palletId).push(b.seq); }
    const toPrint=[];
    for(const [palId,seqs] of byPal){
      const p=pallets.find(x=>x.id===palId); if(!p) continue;
      const seqSet=new Set(seqs);
      p.boxes=p.boxes.filter(b=>!seqSet.has(b.seq));
      if(p.boxes.length===0){
        pallets=pallets.filter(x=>x.id!==palId);
        if(activeId===palId) activeId = pallets.length? pallets[0].id : null;
      } else {
        toPrint.push(palId);
      }
    }
    saveOpt(); render();
    toPrint.forEach((id,i)=> setTimeout(()=>printPallet(id), i*1200));
    flash('Pick confirmed',true);
  }
  ```

- [ ] **Step 2: Add the button in `renderPick`**

  Find:
  ```js
    html+='<div style="margin-top:12px"><button class="btn blue" id="op-printmix">'+ic('printer')+'Print picking mix</button></div>';
    c.innerHTML=html;
    $('op-printmix').onclick=()=>printMix(sol);
  }
  ```
  Replace with:
  ```js
    html+='<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'
      +'<button class="btn blue" id="op-printmix">'+ic('printer')+'Print picking mix</button>'
      +'<button class="btn sec" id="op-confirmpick">'+ic('check')+'Confirm pick</button>'
      +'</div>';
    c.innerHTML=html;
    $('op-printmix').onclick=()=>printMix(sol);
    $('op-confirmpick').onclick=()=>confirmPick(sol);
  }
  ```

- [ ] **Step 3: Syntax-check the script**

  Run the same PowerShell one-liner as Task 1, Step 2. Expected: no output.

- [ ] **Step 4: Verify with a temp Node script**

  Create `qr_task5_test.js`:
  ```js
  let pallets = [
    { id:'pA', name:'Pallet A', boxes:[{seq:1,pieces:20},{seq:2,pieces:10},{seq:3,pieces:100}], meta:{} },
    { id:'pB', name:'Pallet B', boxes:[{seq:1,pieces:50}], meta:{} }
  ];
  let activeId = 'pB';
  let saved=false, rendered=false, printed=[];
  function saveOpt(){ saved=true; }
  function render(){ rendered=true; }
  function flash(){}
  function printPallet(id){ printed.push(id); }
  global.setTimeout = (fn)=>fn();

  function confirmPick(sol){
    if(!sol||!sol.picks.length){ flash('Nothing to pick'); return; }
    const byPal=new Map();
    for(const b of sol.picks){ if(!byPal.has(b.palletId)) byPal.set(b.palletId,[]); byPal.get(b.palletId).push(b.seq); }
    const toPrint=[];
    for(const [palId,seqs] of byPal){
      const p=pallets.find(x=>x.id===palId); if(!p) continue;
      const seqSet=new Set(seqs);
      p.boxes=p.boxes.filter(b=>!seqSet.has(b.seq));
      if(p.boxes.length===0){
        pallets=pallets.filter(x=>x.id!==palId);
        if(activeId===palId) activeId = pallets.length? pallets[0].id : null;
      } else {
        toPrint.push(palId);
      }
    }
    saveOpt(); render();
    toPrint.forEach((id,i)=> setTimeout(()=>printPallet(id), i*1200));
    flash('Pick confirmed',true);
  }

  const assert=require('assert');
  confirmPick({ picks:[ {palletId:'pA',seq:1}, {palletId:'pA',seq:2}, {palletId:'pB',seq:1} ] });

  assert.strictEqual(pallets.length, 1, 'empty pallet B must be removed');
  assert.strictEqual(pallets[0].id, 'pA');
  assert.deepStrictEqual(pallets[0].boxes, [{seq:3,pieces:100}], 'picked boxes removed by seq, remaining box kept');
  assert.strictEqual(activeId, 'pA', 'activeId must move off the removed pallet');
  assert.deepStrictEqual(printed, ['pA'], 'only the still-nonempty pallet gets relabeled');
  assert.ok(saved && rendered);
  console.log('Task 5 tests passed');
  ```
  Run: `node qr_task5_test.js`
  Expected: `Task 5 tests passed`. Then delete the temp file.

- [ ] **Step 5: Commit**

  ```bash
  git add index.html
  git commit -m "feat: add Confirm pick action to remove picked boxes and relabel pallets"
  ```

---

### Task 6: Browser verification

**Files:** none (manual verification only)

- [ ] **Step 1: Open the app**

  Run: `Start-Process index.html`

- [ ] **Step 2: QR ingest — happy path**

  Go to Optimize. In the scan field, type `PC1|1|SEVENUM|PO123|DEL1|US|20,10,100,100` and press Enter (simulates a QR scan, since the hardware scanner just types text + Enter/Tab). Expect: a flash message naming the new pallet and box count, the pallet's name shows `SEVENUM` somewhere in the UI, and the "This pallet" chip list shows 4 boxes (20/10/100/100).

- [ ] **Step 3: QR ingest — duplicate guard**

  Scan the exact same string again. Expect: flash "Pallet already loaded", and the Board view (Pick tab → Board) still shows only one `SEVENUM` pallet, not two.

- [ ] **Step 4: QR ingest — malformed QR rejected**

  Scan `PC1|garbage` (wrong field count). Expect: flash "Invalid pallet QR", no new pallet created, no change to box counts.

- [ ] **Step 5: Rack + box scanning still works after a QR pallet**

  Scan a rack code, e.g. `CG35071601`. Expect: it tags the active (QR-loaded) pallet's rack, not a new pallet. Then scan a plain box barcode, e.g. `NL-00250-A`. Expect: it appends a 5th box (250 pieces) to the same pallet.

- [ ] **Step 6: Manual pallet still works end-to-end**

  Tap "Pallet" to start a new pallet, scan a rack, scan a couple of plain box barcodes. Go to Board view, tap "Print" on this manual pallet. Expect: the print preview/dialog opens with a label showing `PACKCALC · —` (no PN), no `PLT` line, a QR code top-right, the pieces-per-box chips, and a totals row.

- [ ] **Step 7: QR-ingested pallet print**

  In Board view, tap "Print" on the `SEVENUM` pallet. Expect: the label shows `PACKCALC · SEVENUM` and `PLT 1`, plus the QR and chips/totals as above.

- [ ] **Step 8: Confirm pick → remove → relabel**

  Set a target (e.g. `30`) in the Scan tab. Go to the Pick tab — a best-mix combination should show, pulling from one or more pallets. Tap "Confirm pick". Expect: a "Pick confirmed" flash, the print dialog opens (once per affected pallet still holding boxes, roughly 1.2s apart if more than one), and back in Board view the picked boxes are gone from their pallet(s) — any pallet that hit zero boxes has disappeared from the list entirely.

- [ ] **Step 9: Final full-script syntax check**

  Run the same PowerShell one-liner as Task 1, Step 2, against the final `index.html`. Expected: no output.

- [ ] **Step 10: Final review commit (if any cleanup was needed during manual testing)**

  ```bash
  git add index.html
  git commit -m "test: verify pallet QR ingest, print, and confirm-pick flows in browser"
  ```
  (Skip this commit if no code changes were needed during verification.)

---

## Self-Review

**Spec coverage:** QR Payload Format → Tasks 1 & 3. Scope (Optimize-only, no Reconcile changes, no new localStorage keys) → satisfied, nothing in any task touches Reconcile or adds storage keys. Data Model Change → Task 2. Scan Routing (3-tier priority) → Task 3, Step 2. QR Parsing → New Pallet (validation, dedup guard, naming fallback) → Task 3, Step 1. Rack Location (decoupled, unchanged) → no code change needed, verified untouched and re-tested in Task 6, Step 5. QR Encoding (vendored library, inline SVG, re-encode string, manual-pallet blank fields) → Tasks 1 & 2. Label Print Layout (PN/PLT header, QR top-right, pieces-per-box, totals, footer, A4 fallback via existing `printCss` branch) → Task 4. Confirm Pick → Remove → Relabel (grouping, removal, empty-pallet deletion + activeId handling, re-encode + chained print, no confirmation dialog) → Task 5.

**Placeholder scan:** no "TBD"/"add error handling"/"similar to Task N" phrasing anywhere above; every step shows literal before/after code or a literal command.

**Type consistency:** `palletMeta(p)` / `palletQrPayload(p)` / `ingestPalletQr(raw)` / `confirmPick(sol)` names and signatures are identical everywhere they're declared (Tasks 1-3, 5) and everywhere they're called (Tasks 3-6). `newPallet(rack, boxes, meta)`'s new 3-arg signature is used consistently by both existing 1-arg call sites (unchanged, since the new params default) and the new call in `ingestPalletQr`.

**One spec wording resolved during planning:** the spec's footer line was written as `{esc(meta.pn) || site} · {date, time} · QLn420`, but `site` isn't a variable that exists anywhere in this app. Resolved by using the pallet's own `name` (always present, defaults to `pn` for QR pallets or `Pallet N` for manual ones) instead of inventing an undefined `site` concept — `'<div class="foot">'+esc(p.name)+' · '+stamp()+' · QLn420</div>'` in Task 4.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-16-pallet-qr-relabel.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
