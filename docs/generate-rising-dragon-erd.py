"""Generate an editable, row-connected draw.io ERD for Rising Dragon."""

from pathlib import Path
from collections import Counter
from heapq import heappop, heappush
from xml.etree.ElementTree import Element, SubElement, tostring


OUTPUT = Path(__file__).with_name("rising-dragon-erd.drawio")
TABLE_WIDTH = 260
HEADER_HEIGHT = 36
ROW_HEIGHT = 25

# name: (x, y, [(field, type, key marker)])
TABLES = {
    "branch": (60, 50, [
        ("id", "bigint", "PK"), ("name", "varchar", ""),
        ("address", "varchar", ""), ("description", "text", ""),
        ("photo_url", "text", ""), ("is_active", "boolean", ""),
        ("operating_hours", "jsonb", ""),
    ]),
    "user": (60, 340, [
        ("id", "bigint", "PK"), ("role", "USER-DEFINED", ""),
        ("auth_id", "uuid", ""), ("first_name", "text", ""),
        ("middle_name", "text", ""), ("last_name", "text", ""),
        ("primary_branch_id", "bigint", "FK"), ("contact", "text", ""),
    ]),
    "student": (60, 700, [
        ("id", "bigint", "PK"), ("first_name", "varchar", ""),
        ("last_name", "varchar", ""), ("middle_name", "varchar", ""),
        ("guardian_name", "varchar", ""), ("guardian_contact", "varchar", ""),
        ("guardian_email", "varchar", ""), ("belt_level", "varchar", ""),
        ("enrollment_date", "date", ""), ("branch_id", "bigint", "FK"),
        ("is_active", "boolean", ""), ("billing_plan", "text", ""),
    ]),
    "coach_weekly_availability": (410, 45, [
        ("id", "bigint", "PK"), ("coach_id", "bigint", "FK"),
        ("weekday", "smallint", ""), ("time_start", "time", ""),
        ("time_end", "time", ""),
    ]),
    "weekly_class_template": (410, 235, [
        ("id", "bigint", "PK"), ("branch_id", "bigint", "FK"),
        ("coach_id", "bigint", "FK"), ("weekday", "smallint", ""),
        ("time_start", "time", ""), ("time_end", "time", ""),
        ("active_from", "date", ""), ("active_until", "date", ""),
        ("is_active", "boolean", ""),
    ]),
    "schedule_closure": (410, 545, [
        ("id", "bigint", "PK"), ("branch_id", "bigint", "FK"),
        ("starts_on", "date", ""), ("ends_on", "date", ""),
        ("reason", "text", ""), ("is_active", "boolean", ""),
        ("created_by", "bigint", "FK"),
    ]),
    "schedule_absence_report": (410, 845, [
        ("id", "bigint", "PK"), ("coach_id", "bigint", "FK"),
        ("starts_on", "date", ""), ("ends_on", "date", ""),
        ("reason", "text", ""), ("status", "text", ""),
        ("resolution", "text", ""), ("substitute_coach_id", "bigint", "FK"),
        ("resolved_by", "bigint", "FK"),
    ]),
    "promotion": (760, 60, [
        ("id", "bigint", "PK"), ("old_belt", "varchar", ""),
        ("new_belt", "varchar", ""), ("date", "date", ""),
        ("student_id", "bigint", "FK"), ("coach_id", "bigint", "FK"),
    ]),
    "class_schedule": (760, 385, [
        ("id", "bigint", "PK"), ("date", "date", ""),
        ("time_start", "time", ""), ("time_end", "time", ""),
        ("status", "USER-DEFINED", ""), ("branch_id", "bigint", "FK"),
        ("coach_id", "bigint", "FK"), ("weekly_template_id", "bigint", "FK"),
        ("auto_cancelled", "boolean", ""), ("closure_id", "bigint", "FK"),
        ("is_manual_override", "boolean", ""),
        ("is_cross_branch_override", "boolean", ""),
        ("absence_report_id", "bigint", "FK"),
    ]),
    "attendance": (1120, 70, [
        ("id", "bigint", "PK"), ("date", "date", ""),
        ("status", "USER-DEFINED", ""), ("student_id", "bigint", "FK"),
        ("schedule_id", "bigint", "FK"),
    ]),
    "payment_settings": (1120, 330, [
        ("singleton", "boolean", "PK"), ("monthly_fee", "numeric", ""),
        ("updated_by", "bigint", "FK"),
        ("reminder_before_due_days", "integer", ""),
        ("reminder_after_due_days", "integer", ""),
        ("per_session_fee", "numeric", ""),
    ]),
    "payment": (1120, 590, [
        ("id", "bigint", "PK"), ("amount", "numeric", ""),
        ("due_date", "date", ""), ("paid_date", "date", ""),
        ("status", "USER-DEFINED", ""), ("method", "varchar", ""),
        ("student_id", "bigint", "FK"), ("payment_type", "text", ""),
        ("quantity", "integer", ""), ("coverage_start", "date", ""),
        ("notes", "text", ""),
        ("attendance_schedule_id", "bigint", "FK"),
    ]),
    "payment_reminder": (1510, 590, [
        ("id", "bigint", "PK"), ("payment_id", "bigint", "FK"),
        ("sent_by", "bigint", "FK"), ("recipient_email", "text", ""),
        ("status", "text", ""), ("completed_at", "timestamp", ""),
        ("sent_at", "timestamp", ""), ("error_message", "text", ""),
        ("reminder_type", "text", ""), ("scheduled_for", "date", ""),
        ("attempt_count", "integer", ""),
    ]),
}

# (parent table, parent PK, child table, child FK)
RELATIONSHIPS = [
    ("branch", "id", "user", "primary_branch_id"),
    ("branch", "id", "student", "branch_id"),
    ("branch", "id", "class_schedule", "branch_id"),
    ("branch", "id", "weekly_class_template", "branch_id"),
    ("branch", "id", "schedule_closure", "branch_id"),
    ("user", "id", "class_schedule", "coach_id"),
    ("user", "id", "promotion", "coach_id"),
    ("user", "id", "coach_weekly_availability", "coach_id"),
    ("user", "id", "weekly_class_template", "coach_id"),
    ("user", "id", "payment_reminder", "sent_by"),
    ("user", "id", "payment_settings", "updated_by"),
    ("user", "id", "schedule_closure", "created_by"),
    ("user", "id", "schedule_absence_report", "coach_id"),
    ("user", "id", "schedule_absence_report", "substitute_coach_id"),
    ("user", "id", "schedule_absence_report", "resolved_by"),
    ("student", "id", "attendance", "student_id"),
    ("student", "id", "payment", "student_id"),
    ("student", "id", "promotion", "student_id"),
    ("class_schedule", "id", "attendance", "schedule_id"),
    ("class_schedule", "id", "payment", "attendance_schedule_id"),
    ("weekly_class_template", "id", "class_schedule", "weekly_template_id"),
    ("schedule_closure", "id", "class_schedule", "closure_id"),
    ("schedule_absence_report", "id", "class_schedule", "absence_report_id"),
    ("payment", "id", "payment_reminder", "payment_id"),
]


def cell(container, cell_id, value="", style="", **attrs):
    return SubElement(container, "mxCell", {"id": cell_id, "value": value, "style": style, **attrs})


def route_around_tables(start, goal, obstacles, used_nodes, grid=5):
    """Find an orthogonal route on a small grid, avoiding tables and prior lines."""
    from collections import defaultdict

    def snap(point):
        return (round(point[0] / grid) * grid, round(point[1] / grid) * grid)

    start_grid, goal_grid = snap(start), snap(goal)
    bounds = (0, 0, 2250, 1450)
    directions = ((grid, 0, 0), (-grid, 0, 1), (0, grid, 2), (0, -grid, 3))
    # A* state includes the previous direction so bends have a small cost.
    first = (start_grid[0], start_grid[1], 4)
    queue = [(0, 0, first)]
    costs = {first: 0}
    previous = {}
    serial = 0

    while queue:
        _, cost, state = heappop(queue)
        x, y, old_direction = state
        if (x, y) == goal_grid:
            break
        if cost != costs.get(state):
            continue
        for dx, dy, direction in directions:
            nx, ny = x + dx, y + dy
            if not (bounds[0] <= nx <= bounds[2] and bounds[1] <= ny <= bounds[3]):
                continue
            if (nx, ny) in obstacles and (nx, ny) not in (start_grid, goal_grid):
                continue
            next_state = (nx, ny, direction)
            step_cost = grid + (8 if old_direction != 4 and old_direction != direction else 0)
            step_cost += 1200 if (nx, ny) in used_nodes else 0
            step_cost += 180 if any((nx + ox, ny + oy) in used_nodes for ox, oy in ((grid, 0), (-grid, 0), (0, grid), (0, -grid))) else 0
            next_cost = cost + step_cost
            if next_cost < costs.get(next_state, float("inf")):
                costs[next_state] = next_cost
                previous[next_state] = state
                heuristic = abs(goal_grid[0] - nx) + abs(goal_grid[1] - ny)
                serial += 1
                heappush(queue, (next_cost + heuristic, next_cost, next_state))
    else:
        raise RuntimeError(f"Could not route connector between {start} and {goal}")

    state = min((s for s in costs if s[:2] == goal_grid), key=lambda s: costs[s])
    path = [goal_grid]
    while state != first:
        state = previous[state]
        path.append(state[:2])
    path.reverse()

    # Keep only corners. This makes the XML compact and the routes easy to edit.
    corners = [path[0]]
    for index in range(1, len(path) - 1):
        before, current, after = path[index - 1:index + 2]
        if (current[0] - before[0], current[1] - before[1]) != (after[0] - current[0], after[1] - current[1]):
            corners.append(current)
    corners.append(path[-1])
    used_nodes.update(path)
    return corners


def build_diagram():
    mxfile = Element("mxfile", {"host": "app.diagrams.net", "modified": "2026-10-11T00:00:00.000Z", "agent": "Codex", "version": "24.7.17"})
    diagram = SubElement(mxfile, "diagram", {"id": "rising-dragon-erd", "name": "Rising Dragon ERD"})
    model = SubElement(diagram, "mxGraphModel", {"dx": "1800", "dy": "1300", "grid": "1", "gridSize": "10", "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": "1850", "pageHeight": "1300", "math": "0", "shadow": "0"})
    root = SubElement(model, "root")
    SubElement(root, "mxCell", {"id": "0"})
    SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    field_cells = {}
    row_bounds = {}
    table_rects = {}
    table_style = "shape=table;startSize=36;container=1;collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=1;resizeLast=1;fillColor=#2D3436;strokeColor=#52606D;fontColor=#FFFFFF;fontStyle=1;align=center;html=1;"
    # Table content rows must be text cells inside the table container. The
    # `tableRow` shape style leaves the body blank in diagrams.net imports.
    row_style = "text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=5;overflow=hidden;rotatable=0;whiteSpace=wrap;html=1;fontSize=12;fontColor=#1F2937;"

    for name, (x, y, fields) in TABLES.items():
        table_id = f"table_{name}"
        table_height = HEADER_HEIGHT + ROW_HEIGHT * len(fields)
        table_rects[name] = (x, y, x + TABLE_WIDTH, y + table_height)
        table = cell(root, table_id, name, table_style, vertex="1", parent="1")
        SubElement(table, "mxGeometry", {"x": str(x), "y": str(y), "width": str(TABLE_WIDTH), "height": str(table_height), "as": "geometry"})
        for index, (field, data_type, key) in enumerate(fields):
            row_id = f"row_{name}_{field}"
            prefix = f"{key}    " if key else "      "
            # draw.io requires every mxCell to be a sibling under <root>;
            # `parent` links the row cell to its containing table.
            row = cell(root, row_id, f"{prefix}{field} : {data_type}", row_style, vertex="1", parent=table_id)
            SubElement(row, "mxGeometry", {"y": str(HEADER_HEIGHT + ROW_HEIGHT * index), "width": str(TABLE_WIDTH), "height": str(ROW_HEIGHT), "as": "geometry"})
            field_cells[(name, field)] = row_id
            row_bounds[(name, field)] = (x, y + HEADER_HEIGHT + ROW_HEIGHT * index, ROW_HEIGHT)

    # Build padded obstacles. Routes go around every table, with a small gap.
    grid = 5
    obstacles = set()
    padding = 15
    for left, top, right, bottom in table_rects.values():
        for xx in range(((left - padding) // grid) * grid, right + padding + 1, grid):
            for yy in range(((top - padding) // grid) * grid, bottom + padding + 1, grid):
                obstacles.add((xx, yy))

    # Orthogonal ER connectors attach to row cells and use explicit routed points.
    edge_style_base = "edgeStyle=segmentEdgeStyle;rounded=1;html=1;strokeColor=#52606D;strokeWidth=1.2;startArrow=ERone;startFill=0;endArrow=ERmany;endFill=0;"
    used_nodes = set()
    source_counts = Counter((parent_table, parent_key) for parent_table, parent_key, _, _ in RELATIONSHIPS)
    target_counts = Counter((child_table, child_key) for _, _, child_table, child_key in RELATIONSHIPS)
    source_seen = Counter()
    target_seen = Counter()
    for index, (parent_table, parent_key, child_table, child_key) in enumerate(RELATIONSHIPS, 1):
        sx, source_row_y, source_row_height = row_bounds[(parent_table, parent_key)]
        tx, target_row_y, target_row_height = row_bounds[(child_table, child_key)]
        source_key = (parent_table, parent_key)
        target_key = (child_table, child_key)
        source_port = 0.5
        if source_counts[source_key] > 1:
            source_port = 0.12 + 0.76 * source_seen[source_key] / (source_counts[source_key] - 1)
        target_port = 0.5
        if target_counts[target_key] > 1:
            target_port = 0.12 + 0.76 * target_seen[target_key] / (target_counts[target_key] - 1)
        source_seen[source_key] += 1
        target_seen[target_key] += 1
        sy = source_row_y + source_row_height * source_port
        ty = target_row_y + target_row_height * target_port
        source_rect, target_rect = table_rects[parent_table], table_rects[child_table]
        if source_rect[0] < target_rect[0]:
            source_side, target_side = "right", "left"
        elif source_rect[0] > target_rect[0]:
            source_side, target_side = "left", "right"
        else:
            source_side = target_side = "left"

        source_x = source_rect[2] + 20 if source_side == "right" else source_rect[0] - 20
        target_x = target_rect[0] - 20 if target_side == "left" else target_rect[2] + 20
        start = (source_x, sy)
        goal = (target_x, ty)
        corners = route_around_tables(start, goal, obstacles, used_nodes, grid)
        start_grid = (round(start[0] / grid) * grid, round(start[1] / grid) * grid)
        goal_grid = (round(goal[0] / grid) * grid, round(goal[1] / grid) * grid)
        routed_points = []
        if start != start_grid:
            routed_points.extend((start, start_grid))
        routed_points.extend(corners)
        if goal != goal_grid:
            routed_points.extend((goal_grid, goal))
        exit_x, entry_x = ("1", "0") if source_side == "right" else ("0", "1")
        style = edge_style_base + f"exitX={exit_x};exitY={source_port};entryX={entry_x};entryY={target_port};"
        edge = cell(root, f"rel_{index:02d}", "", style, edge="1", parent="1", source=field_cells[(parent_table, parent_key)], target=field_cells[(child_table, child_key)])
        geometry = SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
        points = SubElement(geometry, "Array", {"as": "points"})
        for px, py in routed_points:
            SubElement(points, "mxPoint", {"x": str(px), "y": str(py)})

    return tostring(mxfile, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    OUTPUT.write_bytes(build_diagram())
    print(f"Wrote {OUTPUT}")
