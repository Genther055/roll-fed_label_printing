def calculate_quote(
    target_quantity=5000,
    labels_per_meter=266,
    alt_labels_per_meter=253,
    roll_width_mm=330.0,
    waste_pct=5.0,
    setup_meters=10.0,
    material_cost_per_m2=35.0,
    print_cost_per_m=20.0,
    die_cut_cost=0.0
):
    """
    Calculates commercial and technical order quotation based on layout metrics.
    """
    if labels_per_meter <= 0:
        return {}

    # Net meters
    net_meters = target_quantity / labels_per_meter
    waste_meters = net_meters * (waste_pct / 100.0)
    gross_meters = round(net_meters + waste_meters + setup_meters, 2)

    # Square meters
    roll_width_m = roll_width_mm / 1000.0
    total_m2 = round(gross_meters * roll_width_m, 2)

    # Costs
    mat_cost = round(total_m2 * material_cost_per_m2, 2)
    print_cost = round(gross_meters * print_cost_per_m, 2)
    total_order_cost = round(mat_cost + print_cost + die_cut_cost, 2)
    cost_per_label = round(total_order_cost / target_quantity, 4) if target_quantity > 0 else 0.0

    # Savings compared to alternate orientation (if provided)
    savings = {}
    if alt_labels_per_meter > 0 and alt_labels_per_meter != labels_per_meter:
        alt_net_meters = target_quantity / alt_labels_per_meter
        alt_waste_meters = alt_net_meters * (waste_pct / 100.0)
        alt_gross_meters = round(alt_net_meters + alt_waste_meters + setup_meters, 2)
        alt_m2 = round(alt_gross_meters * roll_width_m, 2)
        alt_total_cost = round(alt_m2 * material_cost_per_m2 + alt_gross_meters * print_cost_per_m + die_cut_cost, 2)
        
        diff_meters = round(alt_gross_meters - gross_meters, 2)
        diff_cost = round(alt_total_cost - total_order_cost, 2)
        savings = {
            "saved_meters": diff_meters,
            "saved_cost": diff_cost,
            "alt_gross_meters": alt_gross_meters,
            "alt_total_cost": alt_total_cost
        }

    return {
        "target_quantity": target_quantity,
        "labels_per_meter": labels_per_meter,
        "net_meters": round(net_meters, 2),
        "waste_meters": round(waste_meters, 2),
        "setup_meters": setup_meters,
        "gross_meters": gross_meters,
        "total_m2": total_m2,
        "material_cost": mat_cost,
        "print_cost": print_cost,
        "die_cut_cost": die_cut_cost,
        "total_cost": total_order_cost,
        "cost_per_label": cost_per_label,
        "savings": savings
    }
