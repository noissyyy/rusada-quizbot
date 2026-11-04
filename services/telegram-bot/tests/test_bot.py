import os
os.environ["MINIAPP_URL"] = "https://quiz.rusada.uz"
os.environ["BOT_USERNAME"] = "Rusada_QuizBot"

import bot  # noqa: E402


def test_language_and_texts():
    assert bot.lang_of("ru") == "ru" and bot.lang_of("uz") == "uz" and bot.lang_of(None) == "uz"
    assert "Здравствуйте, Аня" in bot.t("ru", "hello", name="Аня")
    assert "Assalomu alaykum" in bot.t("en", "hello", name="A")


def test_start_params_are_whitelisted():
    assert bot.valid_start_param("g_abc123") == "g_abc123"
    assert bot.valid_start_param("l_9f8e") == "l_9f8e"
    for bad in (None, "", "x_1", "t_", "g_../../", "g_" + "a" * 80, "javascript:alert(1)"):
        assert bot.valid_start_param(bad) is None


def test_links():
    assert bot.miniapp_url() == "https://quiz.rusada.uz/"
    assert bot.miniapp_url("g_1") == "https://quiz.rusada.uz/?start=g_1"
    assert bot.startapp_link("home") == "https://t.me/Rusada_QuizBot?startapp=home"


def test_router_has_handlers():
    names = {h.callback.__name__ for obs in bot.router.observers.values() for h in obs.handlers}
    assert {"start", "admin", "help_", "group_test", "on_my_status", "seen_in_group"} <= names
