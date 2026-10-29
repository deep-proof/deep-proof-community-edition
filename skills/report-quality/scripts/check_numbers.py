"""Recalculate declared arithmetic without executing document-supplied formulas."""
import json
import sys
from decimal import Decimal, localcontext, InvalidOperation


def calculate(check):
    result = dict(check)
    try:
        if check.get("missingPolicy") != "reject" or not check.get("sourceRefs") or not check.get("unit"):
            raise ValueError("Declare sourceRefs, unit and missingPolicy=reject.")
        with localcontext() as context:
            context.prec = 40
            def number(value):
                if not isinstance(value, str) or len(value) > 200:
                    raise ValueError("Use finite decimal strings for all numbers.")
                parsed = Decimal(value)
                if not parsed.is_finite() or abs(parsed.adjusted()) > 1000:
                    raise ValueError("Number is nonfinite or outside the supported range.")
                return parsed
            values = [number(v) for v in check["values"]]
            if not values:
                raise ValueError("No operands supplied.")
            operation = check["operation"]
            if operation == "sum":
                actual, formula = sum(values), "sum(values)"
            elif operation == "product":
                actual, formula = Decimal(1), "product(values)"
                for value in values:
                    actual *= value
            elif operation in ("difference", "ratio", "percent"):
                if len(values) != 2:
                    raise ValueError("This operation needs exactly two operands.")
                if operation == "difference":
                    actual, formula = values[0] - values[1], "values[0] - values[1]"
                else:
                    if not values[1]:
                        raise ValueError("Zero denominator: result is unavailable.")
                    factor = Decimal(100) if operation == "percent" else Decimal(1)
                    actual, formula = factor * values[0] / values[1], "100 * numerator / denominator" if operation == "percent" else "numerator / denominator"
            elif operation == "weighted_mean":
                weights = [number(w) for w in check["weights"]]
                if len(weights) != len(values) or any(w < 0 for w in weights) or not sum(weights):
                    raise ValueError("Nonnegative weights must match operands and have a positive sum.")
                actual, formula = sum(v * w for v, w in zip(values, weights)) / sum(weights), "sum(value * weight) / sum(weights)"
            else:
                raise ValueError("Unsupported operation.")
            reported, tolerance = number(check["reported"]), number(check["tolerance"])
            if tolerance < 0:
                raise ValueError("Tolerance cannot be negative.")
            difference = actual - reported
            result.update(status="executed", formula=formula, actual=str(actual), difference=str(difference), withinTolerance=abs(difference) <= tolerance, precision=40)
    except (ValueError, KeyError, TypeError, InvalidOperation, ArithmeticError) as error:
        result.update(status="unavailable", reason=str(error))
    return result


if __name__ == "__main__":
    if sys.argv[1] == "--stdio":
        checks = json.load(sys.stdin)
    else:
        with open(sys.argv[1], encoding="utf-8") as source:
            checks = json.load(source)
    if not isinstance(checks, list) or len(checks) > 10000:
        raise ValueError("Input must be an array of at most 10,000 checks.")
    output = [calculate(check) for check in checks]
    if sys.argv[1] == "--stdio":
        json.dump(output, sys.stdout, ensure_ascii=False)
    else:
        with open(sys.argv[2], "x", encoding="utf-8") as target:
            json.dump(output, target, ensure_ascii=False, indent=2)
            target.write("\n")
