var Point = require("./point");

function delta(a, b) {
	return Math.round((a - b) * 32);
}

function contourHash(c) {
	if (!c || c.length < 2) return ".";
	var lx = c[0].x, ly = c[0].y;
	var buf = "";
	for (var j = 1; j < c.length; j++) {
		var z = c[j];
		buf += `${z.on ? 'o' : 'f'}${z.cubic ? 'c' : 'q'}${delta(z.x, lx)},${delta(z.y, ly)};`;
		lx = z.x, ly = z.y;
	}
	return buf;
}

function match(g1, g2, _n) {
	for (let j = 0; j + g1.contours.length <= g2.contours.length; j++) {
		var found = true;
		for (var k = j; k < g2.contours.length && k - j < g1.contours.length; k++) {
			if (g1.contours[k - j].hash !== g2.contours[k].hash
				|| !(k <= j || delta(g1.contours[k - j][0].x, g1.contours[k - j - 1][0].x) === delta(g2.contours[k][0].x, g2.contours[k - 1][0].x)
					&& delta(g1.contours[k - j][0].y, g1.contours[k - j - 1][0].y) === delta(g2.contours[k][0].y, g2.contours[k - 1][0].y))) {
				found = false;
				break;
			}
		}
		if (found) {
			if (!g2.references) g2.references = [];
			g2.references.push({
				glyph: g1.name,
				_n: _n,
				x: g2.contours[j][0].x - g1.contours[0][0].x,
				y: g2.contours[j][0].y - g1.contours[0][0].y
			});
			g2.contours.splice(j, g1.contours.length);
			return true;
		}
	}
	return false;
}

function unlinkRef(g, dx, dy, glyf) {
	var cntrs = g.contours.map(c => c.map(z => new Point(z.x + dx, z.y + dy, z.on, z.cubic)));
	if (g.references)
		for (let r of g.references) {
			cntrs = cntrs.concat(unlinkRef(glyf[r._n], r.x + dx, r.y + dy, glyf));
		}
	return cntrs;
}

function autoref(glyf) {
	supporessNaN(glyf);

	for (var j = 0; j < glyf.length; j++) {
		var g = glyf[j];
		if (g.contours) {
			for (var k = 0; k < g.contours.length; k++) {
				var contour = g.contours[k];
				contour.hash = contourHash(contour);
			}
		}
	}


	// Refl-referencify, forward.
	for (var j = 0; j < glyf.length; j++) {
		if (!glyf[j].contours.length || glyf[j].references && glyf[j].references.length) continue;
		for (var k = j + 1; k < glyf.length; k++) {
			if (glyf[j].contours.length === glyf[k].contours.length) {
				if (match(glyf[j], glyf[k], j)) {
					// console.log("Refl", glyf[j].name, glyf[j].unicode, "->", glyf[k].name, glyf[k].unicode);
				}
			}
		}
	}

	// referencify, backward
	for (var j = 0; j < glyf.length; j++) {
		if (glyf[j].cmpPriority < 0 || !glyf[j].contours.length || glyf[j].references && glyf[j].references.length) continue;
		for (var k = j - 1; k >= 0; k--) {
			if (glyf[j].contours.length > glyf[k].contours.length) continue;
			while (match(glyf[j], glyf[k], j)) {
				// console.log("Part", glyf[j].name, "->", glyf[k].name);
			}
		}
	}

	// unlink composite
	for (var j = 0; j < glyf.length; j++) {
		if (glyf[j].contours.length === 0 || !glyf[j].references || glyf[j].references.length === 0) continue;
		// console.log("Unlink", glyf[j].name);
		var cs = unlinkRef(glyf[j], 0, 0, glyf);
		glyf[j].contours = g.contours.concat(cs);
		glyf[j].references = [];
	}
}

function supporessNaN(glyf) {
	for (var j = 0; j < glyf.length; j++) {
		var g = glyf[j];
		if (!g.contours) continue;
		for (var k = 0; k < g.contours.length; k++) {
			var contour = g.contours[k];
			for (let z of contour) {
				if (!isFinite(z.x)) z.x = 0
				if (!isFinite(z.y)) z.y = 0
			}
		}
	}
}

module.exports = autoref;
