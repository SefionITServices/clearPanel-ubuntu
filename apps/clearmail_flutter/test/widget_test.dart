import 'package:flutter_test/flutter_test.dart';
import 'package:clearmail_flutter/main.dart';

void main() {
  testWidgets('ClearMailApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ClearMailApp());
    expect(find.byType(ClearMailApp), findsOneWidget);
  });
}
