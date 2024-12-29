from logging import DEBUG, Formatter, LogRecord, StreamHandler, getLogger
from logging.handlers import RotatingFileHandler
from pathlib import Path


class ColorCodes:
    RESET = "\033[0m"
    BOLD = "\033[1m"

    # 前景色（文字色）
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

    # 背景色
    BG_BLACK = "\033[40m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_CYAN = "\033[46m"
    BG_WHITE = "\033[47m"


class ColoredFormatter(Formatter):
    """カラー対応のフォーマッター"""

    def __init__(self, fmt=None, datefmt=None):
        super().__init__(fmt, datefmt)

        # ログレベルごとの色設定
        self.COLORS = {
            "DEBUG": ColorCodes.CYAN,
            "INFO": ColorCodes.GREEN,
            "WARNING": ColorCodes.YELLOW,
            "ERROR": ColorCodes.RED,
            "CRITICAL": ColorCodes.RED + ColorCodes.BG_WHITE,
        }

    def format(self, record: LogRecord) -> str:
        # 元のメッセージを保持
        message = record.getMessage()

        # ログレベルに応じた色を取得
        color = self.COLORS.get(record.levelname, "")

        # levelname に色を適用
        colored_levelname = f"{color}{record.levelname}{ColorCodes.RESET}"

        # 一時的に levelname を置き換え
        original_levelname = record.levelname
        record.levelname = colored_levelname

        # フォーマット適用
        formatted_message = super().format(record)

        # 元の levelname を戻す
        record.levelname = original_levelname

        return formatted_message


def setup_logger(
    name: str = __name__,
    log_level: int = DEBUG,
    log_file=None,
    max_bytes: int = 10_485_760,  # 10MB
    backup_count: int = 5,
) -> None:
    """ロギングの設定を行う関数

    Args:
        name: ロガー名 (デフォルト: __name__)
        log_level: ログレベル (デフォルト: DEBUG)
        log_file: ログファイルパス (デフォルト: None)
        max_bytes: ログローテーションのサイズ制限 (デフォルト: 10MB)
        backup_count: 保持するバックアップファイル数 (デフォルト: 5)
    """
    logger = getLogger(name)

    # 既存のハンドラーをクリア（二重登録防止）
    if logger.hasHandlers():
        logger.handlers.clear()

    # カラーフォーマッターの設定（コンソール用）
    console_formatter = ColoredFormatter(
        fmt="[%(levelname)s] [%(asctime)s] [%(filename)s:%(lineno)d] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 通常のフォーマッター（ファイル用）
    file_formatter = Formatter(
        fmt="[%(levelname)s] [%(asctime)s] [%(filename)s:%(lineno)d] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # コンソール出力の設定
    console_handler = StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # ファイル出力の設定（指定された場合）
    if log_file:
        log_file = Path(log_file)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            filename=log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    logger.setLevel(log_level)
    logger.propagate = False


# デフォルトのロガー設定
log = getLogger(__name__)
setup_logger()
log.info("Logger initialized")
