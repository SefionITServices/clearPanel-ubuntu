import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GmailColors {
  // Primary Gmail Accents
  static const Color googleRed = Color(0xFFEA4335);
  static const Color googleBlue = Color(0xFF1A73E8);
  static const Color googleYellow = Color(0xFFFBBC04);
  static const Color googleGreen = Color(0xFF34A853);

  // Backgrounds & Surfaces (Light)
  static const Color scaffoldBackground = Color(0xFFF6F8FC);
  static const Color surfaceWhite = Color(0xFFFFFFFF);
  static const Color searchBarBg = Color(0xFFEAF1FB);
  static const Color searchBarBorder = Colors.transparent;

  // Backgrounds & Surfaces (Dark)
  static const Color darkScaffoldBg = Color(0xFF191A1C);
  static const Color darkSurface = Color(0xFF202124);
  static const Color darkSearchBarBg = Color(0xFF303134);
  static const Color darkText = Color(0xFFE8EAED);
  static const Color darkSnippet = Color(0xFF9AA0A6);

  // Sidebar
  static const Color sidebarActivePill = Color(0xFFD3E3FD);
  static const Color sidebarActiveText = Color(0xFF041E49);
  static const Color sidebarInactiveText = Color(0xFF444746);
  static const Color composePillBg = Color(0xFFC2E7FF);
  static const Color composePillText = Color(0xFF001D35);

  // Thread List
  static const Color threadUnreadBg = Color(0xFFFFFFFF);
  static const Color threadReadBg = Color(0xFFF2F6FC);
  static const Color threadHoverBg = Color(0xFFEDF2FA);
  static const Color threadSelectedBg = Color(0xFFC2DBFE);
  static const Color threadBorder = Color(0xFFF1F3F4);

  // Typography
  static const Color textDark = Color(0xFF1F1F1F);
  static const Color textSnippet = Color(0xFF5E5E5E);
  static const Color textMuted = Color(0xFF747775);

  // Star
  static const Color starActive = Color(0xFFF4B400);
  static const Color starInactive = Color(0xFFB0B0B0);
}

class GmailTheme {
  static ThemeData get lightTheme {
    final base = ThemeData.light(useMaterial3: true);

    return base.copyWith(
      brightness: Brightness.light,
      scaffoldBackgroundColor: GmailColors.scaffoldBackground,
      colorScheme: ColorScheme.fromSeed(
        brightness: Brightness.light,
        seedColor: GmailColors.googleBlue,
        primary: GmailColors.googleBlue,
        surface: GmailColors.surfaceWhite,
      ),
      textTheme: GoogleFonts.robotoTextTheme(base.textTheme).copyWith(
        titleMedium: GoogleFonts.roboto(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: GmailColors.textDark,
        ),
        bodyMedium: GoogleFonts.roboto(
          fontSize: 13,
          color: GmailColors.textDark,
        ),
        bodySmall: GoogleFonts.roboto(
          fontSize: 12,
          color: GmailColors.textSnippet,
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    final base = ThemeData.dark(useMaterial3: true);

    return base.copyWith(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: GmailColors.darkScaffoldBg,
      colorScheme: ColorScheme.fromSeed(
        brightness: Brightness.dark,
        seedColor: GmailColors.googleBlue,
        primary: const Color(0xFF8AB4F8),
        surface: GmailColors.darkSurface,
      ),
      textTheme: GoogleFonts.robotoTextTheme(base.textTheme).copyWith(
        titleMedium: GoogleFonts.roboto(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: GmailColors.darkText,
        ),
        bodyMedium: GoogleFonts.roboto(
          fontSize: 13,
          color: GmailColors.darkText,
        ),
        bodySmall: GoogleFonts.roboto(
          fontSize: 12,
          color: GmailColors.darkSnippet,
        ),
      ),
    );
  }
}
