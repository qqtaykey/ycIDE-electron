/*******************************************************************************
 * 文件名: krnln_dtType.cpp
 * 描述: 系统核心支持库数据类型定义 (增强版，包含控件接口)
 * 作者: ycIDE
 * 创建时间: 2026-01-07
 * 数据类型总数: 48
 ******************************************************************************/

#ifndef __E_STATIC_LIB
#include "include_krnln_header.h"
#include "control/unit_interface.h"
#include "krnln_properties.h"
#include "krnln_events.h"

// 数据类型标志说明:
// LDT_WIN_UNIT         = 窗口组件
// LDT_IS_CONTAINER     = 容器组件
// LDT_IS_TAB_UNIT      = TAB控件
// LDT_IS_FUNCTION_PROVIDER = 功能型组件(不可见)
// LDT_CANNOT_GET_FOCUS = 不能获取焦点


// ============================================================
// 成员命令索引数组
// ============================================================

// 共用窗口组件成员命令索引 (命令379-401, 所有可视窗口组件共享)
static INT s_dtCmdIndex_SharedWin[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401
};
static INT s_dtCmdCount_SharedWin = sizeof(s_dtCmdIndex_SharedWin) / sizeof(INT);

// 编辑框成员命令索引
static INT s_dtCmdIndex_EditBox[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 402
};
static INT s_dtCmdCount_EditBox = sizeof(s_dtCmdIndex_EditBox) / sizeof(INT);

// 画板成员命令索引
static INT s_dtCmdIndex_DrawPanel[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 403,
    404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415,
    416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427,
    428, 429, 430
};
static INT s_dtCmdCount_DrawPanel = sizeof(s_dtCmdIndex_DrawPanel) / sizeof(INT);

// 标签成员命令索引
static INT s_dtCmdIndex_Label[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 431
};
static INT s_dtCmdCount_Label = sizeof(s_dtCmdIndex_Label) / sizeof(INT);

// 组合框成员命令索引
static INT s_dtCmdIndex_ComboBox[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 432,
    433, 434, 435, 436, 437, 438, 439, 440, 441, 442, 443
};
static INT s_dtCmdCount_ComboBox = sizeof(s_dtCmdIndex_ComboBox) / sizeof(INT);

// 列表框成员命令索引
static INT s_dtCmdIndex_ListBox[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 444,
    445, 446, 447, 448, 449, 450, 451, 452, 453, 454, 455, 456,
    457, 458, 459, 460, 461
};
static INT s_dtCmdCount_ListBox = sizeof(s_dtCmdIndex_ListBox) / sizeof(INT);

// 选择列表框成员命令索引
static INT s_dtCmdIndex_ChkListBox[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 462,
    463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474,
    475, 476, 477
};
static INT s_dtCmdCount_ChkListBox = sizeof(s_dtCmdIndex_ChkListBox) / sizeof(INT);

// 选择夹成员命令索引
static INT s_dtCmdIndex_Tab[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 478,
    479, 480
};
static INT s_dtCmdCount_Tab = sizeof(s_dtCmdIndex_Tab) / sizeof(INT);

// 超级链接框成员命令索引
static INT s_dtCmdIndex_HyperLinker[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 481
};
static INT s_dtCmdCount_HyperLinker = sizeof(s_dtCmdIndex_HyperLinker) / sizeof(INT);

// 通用对话框成员命令索引 (功能型组件,不继承窗口命令)
static INT s_dtCmdIndex_CommonDlg[] = { 482 };
static INT s_dtCmdCount_CommonDlg = sizeof(s_dtCmdIndex_CommonDlg) / sizeof(INT);

// 打印机成员命令索引 (功能型组件)
static INT s_dtCmdIndex_Printer[] = {
    483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494,
    495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506,
    507, 508, 509, 510, 511, 512, 513, 514
};
static INT s_dtCmdCount_Printer = sizeof(s_dtCmdIndex_Printer) / sizeof(INT);

// 数据报成员命令索引 (功能型组件)
static INT s_dtCmdIndex_UDP[] = { 515, 516 };
static INT s_dtCmdCount_UDP = sizeof(s_dtCmdIndex_UDP) / sizeof(INT);

// 客户成员命令索引 (功能型组件)
static INT s_dtCmdIndex_Client[] = { 517, 518, 519, 520 };
static INT s_dtCmdCount_Client = sizeof(s_dtCmdIndex_Client) / sizeof(INT);

// 服务器成员命令索引 (功能型组件)
static INT s_dtCmdIndex_Server[] = { 521, 522, 523, 524 };
static INT s_dtCmdCount_Server = sizeof(s_dtCmdIndex_Server) / sizeof(INT);

// 端口成员命令索引 (功能型组件)
static INT s_dtCmdIndex_SerialPort[] = { 525, 526, 527, 528 };
static INT s_dtCmdCount_SerialPort = sizeof(s_dtCmdIndex_SerialPort) / sizeof(INT);

// 表格成员命令索引
static INT s_dtCmdIndex_Grid[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 529,
    530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540, 541,
    542
};
static INT s_dtCmdCount_Grid = sizeof(s_dtCmdIndex_Grid) / sizeof(INT);

// 数据源成员命令索引
static INT s_dtCmdIndex_DataSrc[] = {
    379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389, 390,
    391, 392, 393, 394, 395, 396, 397, 398, 399, 400, 401, 543,
    544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 554, 555,
    556, 557, 558, 559, 560, 561, 562, 563, 564, 565, 566, 567,
    568, 569, 570, 571, 572, 573, 574, 575, 576, 577, 578, 579,
    580, 581, 582, 583, 584, 585, 586, 587, 588, 589, 590, 591,
    592, 593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603,
    604, 605, 606, 607, 608, 609, 610, 611, 612, 613
};
static INT s_dtCmdCount_DataSrc = sizeof(s_dtCmdIndex_DataSrc) / sizeof(INT);

// 外部数据库成员命令索引 (功能型组件)
static INT s_dtCmdIndex_ODBCDB[] = {
    614, 615, 616, 617, 618, 619, 620, 621, 622, 623, 624, 625,
    626, 627, 628, 629, 630, 631, 632
};
static INT s_dtCmdCount_ODBCDB = sizeof(s_dtCmdIndex_ODBCDB) / sizeof(INT);

// 对象成员命令索引 (非窗口组件)
static INT s_dtCmdIndex_ComObject[] = {
    633, 634, 635, 636, 637, 638, 639, 640, 641, 642, 643, 644,
    645, 646, 647, 648, 649, 650, 651, 652, 653, 654, 655, 656,
    657, 658
};
static INT s_dtCmdCount_ComObject = sizeof(s_dtCmdIndex_ComObject) / sizeof(INT);

// 变体型成员命令索引 (非窗口组件)
static INT s_dtCmdIndex_Variant[] = {
    659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670,
    671
};
static INT s_dtCmdCount_Variant = sizeof(s_dtCmdIndex_Variant) / sizeof(INT);

// 数据类型信息数组
LIB_DATA_TYPE_INFO g_DataType_krnln_global_var[] = 
{
    // 索引0: 窗口 - 容器组件
    {"窗口", "window", "本类型对象的方法被除开功能型外所有的窗口组件共享。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT | LDT_IS_CONTAINER, 0, s_evt_Window_count, s_evt_Window, s_prop_Window_count, s_prop_Window, Window_GetInterface},
    
    // 索引1: 菜单
    {"菜单", "menu", "用作指定某一个菜单项目。", 
        0, NULL, 0, 0, s_evt_Menu_count, s_evt_Menu, 0, NULL, NULL},
    
    // 索引2: 字体
    {"字体", "font", "成员<1>的中文名称为\"角度\"，英文名称为\"orient\"，类型为\"整数型（int）\"。", 
        0, NULL, 0, 0, 0, NULL, 0, NULL, NULL},
    
    // 索引3: 编辑框
    {"编辑框", "EditBox", "可供选择的属性值：", 
        s_dtCmdCount_EditBox, s_dtCmdIndex_EditBox, LDT_WIN_UNIT, 0, s_evt_EditBox_count, s_evt_EditBox, s_prop_EditBox_count, s_prop_EditBox, EditBox_GetInterface},
    
    // 索引4: 图片框
    {"图片框", "PicBox", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, 0, NULL, s_prop_PicBox_count, s_prop_PicBox, NullUnit_GetInterface},
    
    // 索引5: 外形框
    {"外形框", "ShapeBox", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT | LDT_CANNOT_GET_FOCUS, 0, 0, NULL, s_prop_ShapeBox_count, s_prop_ShapeBox, NullUnit_GetInterface},
    
    // 索引6: 画板
    {"画板", "DrawPanel", "可供选择的属性值：", 
        s_dtCmdCount_DrawPanel, s_dtCmdIndex_DrawPanel, LDT_WIN_UNIT, 0, s_evt_DrawPanel_count, s_evt_DrawPanel, s_prop_DrawPanel_count, s_prop_DrawPanel, NullUnit_GetInterface},
    
    // 索引7: 分组框
    {"分组框", "GroupBox", "如果希望某一字符成为本分组框中第一个可停留焦点组件的访问键，可以在该字符前面加上一个 & 字符。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT | LDT_IS_CONTAINER, 0, 0, NULL, s_prop_GroupBox_count, s_prop_GroupBox, NullUnit_GetInterface},
    
    // 索引8: 标签
    {"标签", "Label", "如果希望某一字符成为本标签后可停留焦点组件的访问键，可以在该字符前面加上一个 & 字符。", 
        s_dtCmdCount_Label, s_dtCmdIndex_Label, LDT_WIN_UNIT | LDT_CANNOT_GET_FOCUS, 0, s_evt_Label_count, s_evt_Label, s_prop_Label_count, s_prop_Label, Label_GetInterface},
    
    // 索引9: 按钮
    {"按钮", "Button", "本属性指定显示在按钮上的图片。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_Button_count, s_evt_Button, s_prop_Button_count, s_prop_Button, Button_GetInterface},
    
    // 索引10: 选择框
    {"选择框", "CheckBox", "本属性指定显示在选择框上的图片。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_CheckBox_count, s_evt_CheckBox, s_prop_CheckBox_count, s_prop_CheckBox, NullUnit_GetInterface},
    
    // 索引11: 单选框
    {"单选框", "RadioBox", "本属性指定显示在单选框上的图片。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_RadioBox_count, s_evt_RadioBox, s_prop_RadioBox_count, s_prop_RadioBox, NullUnit_GetInterface},
    
    // 索引12: 组合框
    {"组合框", "ComboBox", "注意: 修改本属性会丢失动态添加的项目(以原静态项目覆盖)。", 
        s_dtCmdCount_ComboBox, s_dtCmdIndex_ComboBox, LDT_WIN_UNIT, 0, s_evt_ComboBox_count, s_evt_ComboBox, s_prop_ComboBox_count, s_prop_ComboBox, NullUnit_GetInterface},
    
    // 索引13: 列表框
    {"列表框", "ListBox", "可供选择的属性值：", 
        s_dtCmdCount_ListBox, s_dtCmdIndex_ListBox, LDT_WIN_UNIT, 0, s_evt_ListBox_count, s_evt_ListBox, s_prop_ListBox_count, s_prop_ListBox, NullUnit_GetInterface},
    
    // 索引14: 选择列表框
    {"选择列表框", "ChkListBox", "可供选择的属性值：", 
        s_dtCmdCount_ChkListBox, s_dtCmdIndex_ChkListBox, LDT_WIN_UNIT, 0, s_evt_ChkListBox_count, s_evt_ChkListBox, s_prop_ChkListBox_count, s_prop_ChkListBox, NullUnit_GetInterface},
    
    // 索引15: 横向滚动条
    {"横向滚动条", "HScrollBar", "本属性指定当用户在滚动条的空隙处单击后滚动条位置的增减数值。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_HScrollBar_count, s_evt_HScrollBar, s_prop_HScrollBar_count, s_prop_HScrollBar, NullUnit_GetInterface},
    
    // 索引16: 纵向滚动条
    {"纵向滚动条", "VScrollBar", "本属性指定当用户在滚动条的空隙处单击后滚动条位置的增减数值。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_VScrollBar_count, s_evt_VScrollBar, s_prop_VScrollBar_count, s_prop_VScrollBar, NullUnit_GetInterface},
    
    // 索引17: 进度条
    {"进度条", "ProcessBar", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT | LDT_CANNOT_GET_FOCUS, 0, 0, NULL, s_prop_ProcessBar_count, s_prop_ProcessBar, NullUnit_GetInterface},
    
    // 索引18: 滑块条
    {"滑块条", "SliderBar", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_SliderBar_count, s_evt_SliderBar, s_prop_SliderBar_count, s_prop_SliderBar, NullUnit_GetInterface},
    
    // 索引19: 选择夹
    {"选择夹", "Tab", "可供选择的属性值：", 
        s_dtCmdCount_Tab, s_dtCmdIndex_Tab, LDT_WIN_UNIT | LDT_IS_TAB_UNIT | LDT_IS_CONTAINER, 0, s_evt_Tab_count, s_evt_Tab, s_prop_Tab_count, s_prop_Tab, NullUnit_GetInterface},
    
    // 索引20: 影像框
    {"影像框", "AnimateBox", "本属性指定欲播放影像文件的名称。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引21: 日期框
    {"日期框", "DatePicker", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_DatePicker_count, s_evt_DatePicker, 0, NULL, NullUnit_GetInterface},
    
    // 索引22: 月历
    {"月历", "MonthCalendar", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_MonthCal_count, s_evt_MonthCal, 0, NULL, NullUnit_GetInterface},
    
    // 索引23: 驱动器框
    {"驱动器框", "DriverBox", "本属性在设计时不可用，在运行时可读可写。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_DriverBox_count, s_evt_DriverBox, 0, NULL, NullUnit_GetInterface},
    
    // 索引24: 目录框
    {"目录框", "DirBox", "本属性在设计时不可用，在运行时可读可写。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_DirBox_count, s_evt_DirBox, 0, NULL, NullUnit_GetInterface},
    
    // 索引25: 文件框
    {"文件框", "FileBox", "本属性在设计时不可用，在运行时可读可写。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_FileBox_count, s_evt_FileBox, 0, NULL, NullUnit_GetInterface},
    
    // 索引26: 颜色选择器
    {"颜色选择器", "ColorPicker", "颜色数值为红绿蓝颜色值或\"#透明\"常量值。", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_ColorPicker_count, s_evt_ColorPicker, 0, NULL, NullUnit_GetInterface},
    
    // 索引27: 超级链接框
    {"超级链接框", "HyperLinker", "可供选择的属性值：", 
        s_dtCmdCount_HyperLinker, s_dtCmdIndex_HyperLinker, LDT_WIN_UNIT, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引28: 调节器
    {"调节器", "Spin", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_Spin_count, s_evt_Spin, 0, NULL, NullUnit_GetInterface},
    
    // 索引29: 通用对话框 - 功能型
    {"通用对话框", "CommonDlg", "可供选择的属性值：", 
        s_dtCmdCount_CommonDlg, s_dtCmdIndex_CommonDlg, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引30: 时钟 - 功能型
    {"时钟", "Timer", "指定时钟事件产生的周期，单位为毫秒。如果设定为0，则无时钟事件产生。", 
        0, NULL, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, s_evt_Timer_count, s_evt_Timer, s_prop_Timer_count, s_prop_Timer, NullUnit_GetInterface},
    
    // 索引31: 打印机 - 功能型
    {"打印机", "printer", "本属性指定绘画时所使用的单位，坐标系的 X 轴从左到右，Y 轴从上到下。", 
        s_dtCmdCount_Printer, s_dtCmdIndex_Printer, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引32: 字段信息 - 非窗口组件
    {"字段信息", "FieldInf", "成员<1>的中文名称为\"名称\"，英文名称为\"name\"，类型为\"文本型（text）\"。", 
        0, NULL, 0, 0, 0, NULL, 0, NULL, NULL},
    
    // 索引33: 数据报 - 功能型
    {"数据报", "UDP", "数据报是一种不可靠、小数据量的网络数据交互方式。如果传递的数据量过大，有可能会失败，最好不要超过 127 字节。", 
        s_dtCmdCount_UDP, s_dtCmdIndex_UDP, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, s_evt_UDP_count, s_evt_UDP, 0, NULL, NullUnit_GetInterface},
    
    // 索引34: 客户 - 功能型
    {"客户", "Client", "客户是基于连接的网络数据交换的客户方组件，用作向另一方的服务器端组件发送数据。", 
        s_dtCmdCount_Client, s_dtCmdIndex_Client, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, s_evt_Client_count, s_evt_Client, 0, NULL, NullUnit_GetInterface},
    
    // 索引35: 服务器 - 功能型
    {"服务器", "Server", "服务器是基于连接的网络数据交换的服务方组件，用作在指定端口监视来自客户方的数据。", 
        s_dtCmdCount_Server, s_dtCmdIndex_Server, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, s_evt_Server_count, s_evt_Server, 0, NULL, NullUnit_GetInterface},
    
    // 索引36: 端口 - 功能型
    {"端口", "SerialPort", "端口组件提供对端口的直接读写操作。", 
        s_dtCmdCount_SerialPort, s_dtCmdIndex_SerialPort, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, s_evt_SerialPort_count, s_evt_SerialPort, 0, NULL, NullUnit_GetInterface},
    
    // 索引37: 打印设置信息 - 非窗口组件
    {"打印设置信息", "PrintInf", "成员<1>的中文名称为\"纸张类型\"，英文名称为\"Paper\"，类型为\"整数型（int）\"。", 
        0, NULL, 0, 0, 0, NULL, 0, NULL, NULL},
    
    // 索引38: 表格
    {"表格", "Grid", "指定提供数据的数据源组件名。", 
        s_dtCmdCount_Grid, s_dtCmdIndex_Grid, LDT_WIN_UNIT, 0, s_evt_Grid_count, s_evt_Grid, s_prop_Grid_count, s_prop_Grid, NullUnit_GetInterface},
    
    // 索引39: 数据源
    {"数据源", "DataSrc", "数据源提供对各种来源数据的统一操作接口。", 
        s_dtCmdCount_DataSrc, s_dtCmdIndex_DataSrc, LDT_WIN_UNIT, 0, s_evt_DataSrc_count, s_evt_DataSrc, 0, NULL, NullUnit_GetInterface},
    
    // 索引40: 通用提供者 - 功能型
    {"通用提供者", "NProvider", "通用提供者用作为数据源提供对数据的通常存取操作。使用内存作为数据的存储仓库。", 
        0, NULL, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引41: 数据库提供者 - 功能型
    {"数据库提供者", "DBProvider", "数据库提供者用作为数据源提供对数据库的存取操作。", 
        0, NULL, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引42: 图形按钮
    {"图形按钮", "PicBtn", "可供选择的属性值：", 
        s_dtCmdCount_SharedWin, s_dtCmdIndex_SharedWin, LDT_WIN_UNIT, 0, s_evt_PicBtn_count, s_evt_PicBtn, 0, NULL, NullUnit_GetInterface},
    
    // 索引43: 外部数据库 - 功能型
    {"外部数据库", "ODBCDB", "本组件提供通过ODBC对外部数据库直接操作的方法。", 
        s_dtCmdCount_ODBCDB, s_dtCmdIndex_ODBCDB, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引44: 外部数据提供者 - 功能型
    {"外部数据提供者", "ODBCProvider", "外部数据提供者用作为数据源提供对外部ODBC数据库的存取操作。", 
        0, NULL, LDT_WIN_UNIT | LDT_IS_FUNCTION_PROVIDER, 0, 0, NULL, 0, NULL, NullUnit_GetInterface},
    
    // 索引45: 对象 - 非窗口组件
    {"对象", "ComObject", "提供对微软公司 COM 对象的支持。", 
        s_dtCmdCount_ComObject, s_dtCmdIndex_ComObject, 0, 0, 0, NULL, 0, NULL, NULL},
    
    // 索引46: 变体型 - 非窗口组件
    {"变体型", "Variant", "提供对COM接口中Variant数据类型(即VB中的Any数据类型)的支持。", 
        s_dtCmdCount_Variant, s_dtCmdIndex_Variant, 0, 0, 0, NULL, 0, NULL, NULL},
    
    // 索引47: 变体类型 - 非窗口组件
    {"变体类型", "VariantType", "提供变体型中所能够容纳数据类型的枚举值。", 
        0, NULL, LDT_ENUM, 0, 0, NULL, 0, NULL, NULL},
};

int g_DataType_krnln_global_var_count = 48;

#endif
