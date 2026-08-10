from django.urls import path
from .views import MailSSORedirectView

urlpatterns = [
    path("", MailSSORedirectView.as_view(), name="mail-sso"),
]
