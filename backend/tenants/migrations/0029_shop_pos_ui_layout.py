from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0028_alter_shop_business_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='pos_ui_layout',
            field=models.CharField(default='standard', help_text="POS UI layout mode: 'standard' or 'visual_grid'", max_length=30),
        ),
    ]
