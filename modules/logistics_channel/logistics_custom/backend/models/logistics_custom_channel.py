# -*- coding: utf-8 -*-
# 为向后兼容保留独立文件；实际模型定义已置于 logistics_custom.py 中。
# 如果您需要扩展字段，可在此文件中追加模型或 Mixin，并在迁移中同步。
from .logistics_custom import LogisticsCustomChannel, LogisticsCustom, Base  # noqa
