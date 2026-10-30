import math

FINAT_SCHEMES = {
    1: {"name": "Схема 1: Головою вперед (назовні)", "rotation": 0, "wound": "out", "desc": "Верх етикетки виходить першим, намотка назовні"},
    2: {"name": "Схема 2: Ногами вперед (назовні)", "rotation": 180, "wound": "out", "desc": "Низ етикетки виходить першим, намотка назовні"},
    3: {"name": "Схема 3: Правим боком вперед (назовні)", "rotation": 90, "wound": "out", "desc": "Правий край виходить першим, намотка назовні"},
    4: {"name": "Схема 4: Лівим боком вперед (назовні)", "rotation": 270, "wound": "out", "desc": "Лівий край виходить першим, намотка назовні"},
    5: {"name": "Схема 5: Головою вперед (всередину)", "rotation": 0, "wound": "in", "desc": "Верх етикетки виходить першим, намотка всередину"},
    6: {"name": "Схема 6: Ногами вперед (всередину)", "rotation": 180, "wound": "in", "desc": "Низ етикетки виходить першим, намотка всередину"},
    7: {"name": "Схема 7: Правим боком вперед (всередину)", "rotation": 90, "wound": "in", "desc": "Правий край виходить першим, намотка всередину"},
    8: {"name": "Схема 8: Лівим боком вперед (всередину)", "rotation": 270, "wound": "in", "desc": "Лівий край виходить першим, намотка всередину"},
}

def evaluate_variant(w, h, rot_deg, roll_w, printable_w, meter_l, gap_x, gap_y):
    """
    Evaluates layout for a specific rotation (0, 90, 180, 270).
    Horizontal roll coordinates:
    - X axis: along 1000 mm roll length (sideways / вбік), gap_x is spacing between repeats.
    - Y axis: across 330 mm roll width (vertical / по висоті), gap_y is spacing between lanes.
    """
    dim_y = w if rot_deg in (0, 180) else h # dimension across roll width (Y)
    dim_x = h if rot_deg in (0, 180) else w # dimension along roll length (X)

    # Calculate number of lanes across roll (Y axis)
    if dim_y <= 0 or (dim_y + gap_y) <= 0:
        lanes = 0
    else:
        lanes = int(math.floor((printable_w + gap_y) / (dim_y + gap_y)))

    # Calculate repeats along running meter length (X axis, sideways / вбік)
    if dim_x <= 0 or (dim_x + gap_x) <= 0:
        repeats = 0
    else:
        repeats = int(math.floor((meter_l + gap_x) / (dim_x + gap_x)))

    total_per_meter = lanes * repeats
    layout_w = round(lanes * dim_y + (lanes - 1) * gap_y, 2) if lanes > 0 else 0.0
    side_margin_y = round((roll_w - layout_w) / 2.0, 2)
    step_x = round(dim_x + gap_x, 2) # крок вбік (рапорт)
    step_y = round(dim_y + gap_y, 2) # крок по висоті полотна

    label_area = w * h
    total_label_area = total_per_meter * label_area
    meter_area = roll_w * meter_l
    efficiency = round((total_label_area / meter_area) * 100.0, 2) if meter_area > 0 else 0.0

    return {
        "rotation": rot_deg,
        "placed_width": dim_y,
        "placed_height": dim_x,
        "dim_x": dim_x,
        "dim_y": dim_y,
        "lanes": lanes,
        "repeats": repeats,
        "total_per_meter": total_per_meter,
        "layout_width": layout_w,
        "side_margin": side_margin_y,
        "step_x": step_x,
        "step_y": step_y,
        "efficiency_pct": efficiency,
        "waste_pct": round(100.0 - efficiency, 2)
    }

def calculate_layout(
    label_width=24.0,
    label_height=40.0,
    bleed=2.0,
    roll_width=330.0,
    printable_width=305.0,
    meter_length=1000.0,
    gap_x=2.0,
    gap_y=2.0,
    application_type="manual", # "manual" or "auto"
    orientation_mode="auto_max", # "auto_max", "portrait" (0), "landscape" (90), "custom"
    winding_scheme=1, # 1..8 for auto application
    custom_rotation=0
):
    """
    Calculates the optimal roll imposition for the label.
    """
    gap_x = max(0.0, float(gap_x))
    gap_y = max(0.0, float(gap_y))
    # Evaluate Portrait (0 deg) and Landscape (90 deg)
    portrait_res = evaluate_variant(label_width, label_height, 0, roll_width, printable_width, meter_length, gap_x, gap_y)
    landscape_res = evaluate_variant(label_width, label_height, 90, roll_width, printable_width, meter_length, gap_x, gap_y)

    chosen_rotation = 0
    recommendation_text = ""
    is_landscape_better = landscape_res["total_per_meter"] > portrait_res["total_per_meter"]
    diff_labels = abs(landscape_res["total_per_meter"] - portrait_res["total_per_meter"])
    min_labels = min(portrait_res["total_per_meter"], landscape_res["total_per_meter"])
    diff_pct = round((diff_labels / min_labels * 100.0), 1) if min_labels > 0 else 0.0

    if application_type == "manual":
        if orientation_mode == "auto_max":
            if is_landscape_better:
                chosen_rotation = 90
                recommendation_text = f"Альбомна орієнтація дає на {diff_labels} етикеток більше на 1 пог. м (+{diff_pct}% економії матеріалу!). Рекомендовано для ручного нанесення."
            elif portrait_res["total_per_meter"] > landscape_res["total_per_meter"]:
                chosen_rotation = 0
                recommendation_text = f"Портретна орієнтація дає на {diff_labels} етикеток більше на 1 пог. м (+{diff_pct}% економії матеріалу!). Рекомендовано для ручного нанесення."
            else:
                chosen_rotation = 0
                recommendation_text = "Обидві орієнтації дають однакову кількість етикеток на погонний метр."
        elif orientation_mode == "portrait":
            chosen_rotation = 0
            recommendation_text = "Вибрано фіксовану портретну орієнтацію."
        elif orientation_mode == "landscape":
            chosen_rotation = 90
            recommendation_text = "Вибрано фіксовану альбомну орієнтацію."
        else:
            chosen_rotation = custom_rotation
    else: # automatic application
        scheme_info = FINAT_SCHEMES.get(int(winding_scheme), FINAT_SCHEMES[1])
        chosen_rotation = scheme_info["rotation"]
        recommendation_text = f"Автоматичне нанесення: {scheme_info['name']}. Орієнтація зафіксована відповідно до вимог етикетувального автомата."

    # Active chosen evaluation
    active_eval = evaluate_variant(label_width, label_height, chosen_rotation, roll_width, printable_width, meter_length, gap_x, gap_y)

    # Generate matrix of coordinates for rendering and imposition
    lanes = active_eval["lanes"]
    repeats = active_eval["repeats"]
    dim_x = active_eval["dim_x"]
    dim_y = active_eval["dim_y"]
    side_margin_y = active_eval["side_margin"]

    positions = []
    # Start repeats with lead-in offset along horizontal X axis
    start_x = round(max(bleed, gap_x), 2)
    for r in range(repeats):
        x = round(start_x + r * (dim_x + gap_x), 2)
        for l in range(lanes):
            y = round(side_margin_y + l * (dim_y + gap_y), 2)
            positions.append({
                "lane": l + 1,
                "repeat": r + 1,
                "x": x,
                "y": y,
                "width": dim_x,
                "height": dim_y,
                "rotation": chosen_rotation
            })

    return {
        "params": {
            "label_width": label_width,
            "label_height": label_height,
            "bleed": bleed,
            "roll_width": roll_width,
            "printable_width": printable_width,
            "meter_length": meter_length,
            "gap_x": gap_x,
            "gap_y": gap_y,
            "application_type": application_type,
            "orientation_mode": orientation_mode,
            "winding_scheme": winding_scheme,
            "chosen_rotation": chosen_rotation
        },
        "active": active_eval,
        "comparison": {
            "portrait": portrait_res,
            "landscape": landscape_res,
            "best_orientation": "landscape" if is_landscape_better else "portrait",
            "diff_labels": diff_labels,
            "diff_pct": diff_pct,
            "recommendation_text": recommendation_text
        },
        "positions": positions
    }
