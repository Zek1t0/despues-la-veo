import { Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { radius, space, type } from "../../theme/presentation";
import { OrganizationText } from "../organization/OrganizationUI";

export function GranularCoveragePanel({ marked, caption, percent, scope, denominator, outside = 0 }: {
  marked: number; caption: string; percent?: number | null; scope: string; denominator?: number | null; outside?: number;
}) {
  const {theme}=useAppTheme();
  return <View style={{gap:space.sm,borderRadius:radius.card,backgroundColor:theme.global.surfaceSecondary,padding:space.md}}>
    <OrganizationText muted>{scope}</OrganizationText>
    <View style={{flexDirection:"row",flexWrap:"wrap",alignItems:"baseline",gap:space.sm}}>
      <Text style={[type.heading,{color:theme.global.textPrimary,fontVariant:["tabular-nums"]}]}>{denominator!=null?`${marked} / ${denominator}`:marked}</Text>
      <OrganizationText>{denominator!=null?"estrenados marcados":marked===1?"unidad marcada":"unidades marcadas"}</OrganizationText>
    </View>
    <OrganizationText>{caption}{percent!=null?` · ${percent}%`:""}</OrganizationText>
    {outside>0&&<OrganizationText muted>{outside} {outside===1?"marca fuera":"marcas fuera"} del conteo mostrado</OrganizationText>}
    {percent!=null&&<View accessibilityRole="progressbar" accessibilityLabel={`Cobertura · ${scope}`}
      accessibilityValue={{min:0,max:100,now:percent}} style={{height:8,borderRadius:radius.round,
        backgroundColor:theme.global.borderStrong,overflow:"hidden"}}>
      <View style={{width:`${percent}%`,height:"100%",backgroundColor:theme.global.accent}} />
    </View>}
  </View>;
}
