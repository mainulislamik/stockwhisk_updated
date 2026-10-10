import csv
import io
from django.http import HttpResponse


def generate_csv_response(filename: str, headers: list, rows: list):
    """
    Generates an HttpResponse containing a CSV file with UTF-8 BOM
    for full Bangla/Unicode compatibility in Microsoft Excel, Google Sheets, and LibreOffice.
    """
    output = io.StringIO()
    # Write UTF-8 BOM
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

    response = HttpResponse(output.getvalue().encode('utf-8'), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
