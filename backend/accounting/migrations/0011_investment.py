# Generated migration for Investment model
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('tenants', '0001_initial'),
        ('accounting', '0010_fix_purchase_investment_and_settlement_negatives'),
    ]

    operations = [
        migrations.CreateModel(
            name='Investment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('investor_name', models.CharField(help_text='Name of the investor, owner, or partner', max_length=150)),
                ('type', models.CharField(choices=[('capital', 'Owner / Partner Capital'), ('loan', 'Loan / Borrowing'), ('equity', 'Equity / Share'), ('other', 'Other Investment')], default='capital', max_length=30)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(0)])),
                ('invested_on', models.DateField(default=django.utils.timezone.localdate)),
                ('payment_method', models.CharField(blank=True, default='cash', max_length=40)),
                ('reference', models.CharField(blank=True, max_length=120)),
                ('note', models.TextField(blank=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='investments', to='accounts.user')),
                ('shop', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='%(class)ss', to='tenants.shop')),
            ],
            options={
                'ordering': ['-invested_on', '-created_at'],
                'indexes': [models.Index(fields=['shop', 'invested_on'], name='accounting__shop_id_bd7995_idx')],
                'constraints': [models.CheckConstraint(check=models.Q(('amount__gte', 0)), name='investment_amount_non_negative')],
            },
        ),
    ]
