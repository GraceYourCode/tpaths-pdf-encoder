import type {PropsWithChildren} from 'react';
import {SafeAreaView,ScrollView,StyleSheet,ViewStyle} from 'react-native';
export function Screen({children,scroll=true,style}:PropsWithChildren<{scroll?:boolean;style?:ViewStyle}>){return scroll?<SafeAreaView style={s.safe}><ScrollView contentContainerStyle={[s.content,style]} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>:<SafeAreaView style={[s.safe,style]}>{children}</SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#fff'},content:{padding:24,paddingBottom:50,gap:16}});
