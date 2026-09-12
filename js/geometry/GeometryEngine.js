class GeometryEngine {
    static polygonCenter(polygon) {
        if (!polygon || polygon.length === 0) return {x: 0, y: 0};
        let cx = 0, cy = 0;
        let signedArea = 0;

        for (let i = 0; i < polygon.length; i++) {
            let j = (i + 1) % polygon.length;
            let a = polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
            signedArea += a;
            cx += (polygon[i].x + polygon[j].x) * a;
            cy += (polygon[i].y + polygon[j].y) * a;
        }

        signedArea *= 0.5;
        // If area is 0, just use simple average
        if (Math.abs(signedArea) < 0.0001) {
             for (let i = 0; i < polygon.length; i++) {
                 cx += polygon[i].x;
                 cy += polygon[i].y;
             }
             return {x: cx / polygon.length, y: cy / polygon.length};
        }

        cx /= (6 * signedArea);
        cy /= (6 * signedArea);
        return {x: cx, y: cy};
    }

    static distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    static distanceToSegment(p, v, w) {
        const l2 = Math.pow(this.distance(v, w), 2);
        if (l2 === 0) return this.distance(p, v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return this.distance(p, {
            x: v.x + t * (w.x - v.x),
            y: v.y + t * (w.y - v.y)
        });
    }

    static projectPointOnLine(p, v, w) {
        const l2 = Math.pow(this.distance(v, w), 2);
        if (l2 === 0) return {x: v.x, y: v.y};
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return {
            x: v.x + t * (w.x - v.x),
            y: v.y + t * (w.y - v.y)
        };
    }

    static snapPoint(point, walls, snapDistance = 15) {
        let closest = null;
        let minDistance = snapDistance;

        for (const wall of walls) {
            // Snap to endpoints
            const dStart = this.distance(point, wall.start);
            if (dStart < minDistance) {
                minDistance = dStart;
                closest = { x: wall.start.x, y: wall.start.y };
            }

            const dEnd = this.distance(point, wall.end);
            if (dEnd < minDistance) {
                minDistance = dEnd;
                closest = { x: wall.end.x, y: wall.end.y };
            }

            // Snap to line segment if no endpoint is closer
            if (!closest) {
                const pLine = this.projectPointOnLine(point, wall.start, wall.end);
                const dLine = this.distance(point, pLine);
                if (dLine < minDistance) {
                    minDistance = dLine;
                    closest = pLine;
                }
            }
        }

        return closest || point;
    }

    static detectRooms(walls) {
        // Complex polygon detection from line segments.
        // For a simple implementation, we'll build a graph of endpoints and find cycles.

        // 1. Build adjacency list for vertices
        const vertices = [];
        const edges = [];
        const EPSILON = 1; // 1 pixel tolerance

        const getVertexId = (p) => {
            let idx = vertices.findIndex(v => this.distance(v, p) < EPSILON);
            if (idx === -1) {
                vertices.push({...p});
                idx = vertices.length - 1;
            }
            return idx;
        };

        // If walls intersect, they should be split into smaller segments for proper cycle detection.
        // This is a basic implementation without line-intersection splitting for simplicity.
        // In a full implementation, you would first find all intersections and split walls.

        // Let's implement a simple Bentley-Ottmann style or just brute force intersection splitting
        let segments = [...walls.map(w => ({start: {...w.start}, end: {...w.end}}))];
        segments = this.splitSegmentsAtIntersections(segments);

        for (const seg of segments) {
            const v1 = getVertexId(seg.start);
            const v2 = getVertexId(seg.end);
            if (v1 !== v2) {
                edges.push([v1, v2]);
            }
        }

        // 2. Find minimum weight cycles or use planar graph faces extraction.
        // A simple approach is finding polygons using a right-most turn approach (finding faces).
        return this.extractFaces(vertices, edges);
    }

    static getIntersection(p1, p2, p3, p4) {
        const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        if (denom === 0) return null; // parallel

        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return {
                x: p1.x + ua * (p2.x - p1.x),
                y: p1.y + ua * (p2.y - p1.y)
            };
        }
        return null;
    }

    static splitSegmentsAtIntersections(segments) {
        let result = [];
        for (let i = 0; i < segments.length; i++) {
            let seg = segments[i];
            let splits = [];

            for (let j = 0; j < segments.length; j++) {
                if (i === j) continue;
                let other = segments[j];
                let pt = this.getIntersection(seg.start, seg.end, other.start, other.end);

                // If intersects not exactly at endpoints
                if (pt && this.distance(pt, seg.start) > 1 && this.distance(pt, seg.end) > 1) {
                    splits.push(pt);
                }
            }

            if (splits.length > 0) {
                // Sort splits by distance from start
                splits.sort((a, b) => this.distance(seg.start, a) - this.distance(seg.start, b));

                let current = seg.start;
                for (let pt of splits) {
                    result.push({start: current, end: pt});
                    current = pt;
                }
                result.push({start: current, end: seg.end});
            } else {
                result.push(seg);
            }
        }
        return result;
    }

    static extractFaces(vertices, edges) {
        // Map of vertex index to list of connected vertices
        const adj = new Map();
        for (let i = 0; i < vertices.length; i++) adj.set(i, []);

        edges.forEach(([u, v]) => {
            if (!adj.get(u).includes(v)) adj.get(u).push(v);
            if (!adj.get(v).includes(u)) adj.get(v).push(u);
        });

        // Sort edges radially around each vertex
        const adjSorted = new Map();
        for (let [u, neighbors] of adj.entries()) {
            const p_u = vertices[u];
            const sorted = [...neighbors].sort((a, b) => {
                const p_a = vertices[a];
                const p_b = vertices[b];
                const angle_a = Math.atan2(p_a.y - p_u.y, p_a.x - p_u.x);
                const angle_b = Math.atan2(p_b.y - p_u.y, p_b.x - p_u.x);
                return angle_a - angle_b;
            });
            adjSorted.set(u, sorted);
        }

        const visited = new Set();
        const faces = [];

        // Traverse edges to find faces (minimum cycles)
        for (let [u, neighbors] of adjSorted.entries()) {
            for (let v of neighbors) {
                const edgeKey = `${u}->${v}`;
                if (visited.has(edgeKey)) continue;

                const cycle = [];
                let curr = u;
                let next = v;

                while (true) {
                    cycle.push(curr);
                    visited.add(`${curr}->${next}`);

                    const nextNeighbors = adjSorted.get(next);
                    // Find the edge 'curr' coming into 'next'
                    const idx = nextNeighbors.indexOf(curr);
                    // The next edge to take is the one to the "left" (counter-clockwise)
                    let nextNextIdx = (idx - 1);
                        if (nextNextIdx < 0) nextNextIdx += nextNeighbors.length;
                    const nextNext = nextNeighbors[nextNextIdx];

                    curr = next;
                    next = nextNext;

                    if (curr === u) break;
                    if (cycle.length > vertices.length) break; // Fallback for infinite loops
                }

                if (cycle.length >= 3) {
                    // Check if it's an outer boundary (area > 0 for standard traversal, wait, we need signed area)
                    const polygon = cycle.map(idx => vertices[idx]);
                    const area = this.polygonArea(polygon);

                    // In our screen coordinate system (y goes down), CCW is positive area.
                    // Inner faces usually have positive area in this traversal if they are interior.
                    // We only want interior rooms.
                    if (area > 0) {
                        faces.push({
                            boundary: polygon,
                            area: area // Area in canvas units squared
                        });
                    }
                }
            }
        }
        return faces;
    }

    static pointInPolygon(point, vs) {
        let x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;
            let intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    static polygonArea(vertices) {
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            let j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= j < vertices.length ? vertices[j].x * vertices[i].y : 0;
        }
        return area / 2;
    }
}