from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0010_plan_limit_visibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscriptionplan",
            name="yearly_discount_percent",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
