import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:clearmail_flutter/main.dart';

void main() {
  testWidgets('ClearMailApp smoke test', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ClearMailApp());
    expect(find.byType(ClearMailApp), findsOneWidget);
  });
}
