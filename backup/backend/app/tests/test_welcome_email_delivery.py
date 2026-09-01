import unittest
from unittest.mock import MagicMock, patch

from app.services.ses_service import SESService
from app.api.v1.endpoints.admin_api import _send_welcome_emails


class TestWelcomeEmailDelivery(unittest.TestCase):

    def _service(self):
        # Avoid SESService.__init__ so tests never create a real boto3 client.
        service = SESService.__new__(SESService)
        service.is_enabled = True
        service.client = MagicMock()
        return service

    def test_send_welcome_email_returns_ses_message_id(self):
        service = self._service()
        service.client.send_email.return_value = {
            "MessageId": "test-message-id-123"
        }

        message_id = service.send_welcome_email(
            "student@example.com",
            "TempSecret123!",
            "Test Professor",
        )

        self.assertEqual(message_id, "test-message-id-123")
        service.client.send_email.assert_called_once()

        kwargs = service.client.send_email.call_args.kwargs
        self.assertEqual(
            kwargs["Destination"]["ToAddresses"],
            ["student@example.com"],
        )

        # Password belongs in the email body, not application logs.
        self.assertIn(
            "TempSecret123!",
            kwargs["Message"]["Body"]["Text"]["Data"],
        )
        self.assertIn(
            "TempSecret123!",
            kwargs["Message"]["Body"]["Html"]["Data"],
        )

    def test_send_welcome_email_raises_when_ses_disabled_without_logging_password(self):
        service = SESService.__new__(SESService)
        service.is_enabled = False
        service.client = None

        password = "DO-NOT-LOG-THIS-PASSWORD"

        with patch("app.services.ses_service.logger") as mock_logger:
            with self.assertRaisesRegex(
                RuntimeError,
                "disabled or unconfigured",
            ):
                service.send_welcome_email(
                    "student@example.com",
                    password,
                    "Test Professor",
                )

        all_log_calls = (
            list(mock_logger.debug.call_args_list)
            + list(mock_logger.info.call_args_list)
            + list(mock_logger.warning.call_args_list)
            + list(mock_logger.error.call_args_list)
            + list(mock_logger.critical.call_args_list)
        )

        self.assertNotIn(password, repr(all_log_calls))

    def test_send_welcome_email_propagates_ses_failure_without_logging_password(self):
        service = self._service()
        password = "ANOTHER-SECRET-PASSWORD"

        service.client.send_email.side_effect = RuntimeError(
            "simulated SES transport failure"
        )

        with patch("app.services.ses_service.logger") as mock_logger:
            with self.assertRaisesRegex(
                RuntimeError,
                "simulated SES transport failure",
            ):
                service.send_welcome_email(
                    "student@example.com",
                    password,
                    "Test Professor",
                )

        self.assertTrue(mock_logger.error.called)
        self.assertNotIn(
            password,
            repr(mock_logger.error.call_args_list),
        )

    def test_send_welcome_email_rejects_missing_message_id(self):
        service = self._service()
        service.client.send_email.return_value = {}

        with self.assertRaisesRegex(
            RuntimeError,
            "returned no MessageId",
        ):
            service.send_welcome_email(
                "student@example.com",
                "TempSecret123!",
                "Test Professor",
            )

    @patch(
        "app.services.ses_service.ses_service.send_welcome_email",
        return_value="ses-message-abc",
    )
    @patch("app.api.v1.endpoints.admin_api.logger")
    def test_background_wrapper_logs_success_message_id(
        self,
        mock_logger,
        mock_send,
    ):
        password = "WRAPPER-SECRET"

        _send_welcome_emails(
            [("student@example.com", password)],
            "Professor Example",
        )

        mock_send.assert_called_once_with(
            "student@example.com",
            password,
            "Professor Example",
        )

        self.assertTrue(mock_logger.info.called)

        log_repr = repr(mock_logger.info.call_args_list)

        self.assertIn("student@example.com", log_repr)
        self.assertIn("ses-message-abc", log_repr)
        self.assertNotIn(password, log_repr)

    @patch(
        "app.services.ses_service.ses_service.send_welcome_email",
        side_effect=RuntimeError("simulated SES rejection"),
    )
    @patch("app.api.v1.endpoints.admin_api.logger")
    def test_background_wrapper_logs_failure_without_password(
        self,
        mock_logger,
        mock_send,
    ):
        password = "WRAPPER-FAILURE-SECRET"

        # Background wrapper deliberately continues rather than crashing
        # the already-completed bulk-import HTTP response.
        _send_welcome_emails(
            [("student@example.com", password)],
            "Professor Example",
        )

        mock_send.assert_called_once()

        self.assertTrue(mock_logger.error.called)

        log_repr = repr(mock_logger.error.call_args_list)

        self.assertIn("student@example.com", log_repr)
        self.assertIn("simulated SES rejection", log_repr)
        self.assertNotIn(password, log_repr)


if __name__ == "__main__":
    unittest.main()
