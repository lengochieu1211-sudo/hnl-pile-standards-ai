using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Web.Script.Serialization;

// HNL Pile Standards AI v1.25.7 — Windows-only CSi live reader.
// Reads raw structural data only. No pile engineering calculations are allowed here.
class HnlCsiLiveBridge
{
    static object GetProp(object o, string name) { return o.GetType().InvokeMember(name, BindingFlags.GetProperty, null, o, null); }
    static object Call(object o, string name, params object[] args) { return o.GetType().InvokeMember(name, BindingFlags.InvokeMethod, null, o, args); }
    static MethodInfo FindMethod(object o, string name, int argc) { return o.GetType().GetMethods().FirstOrDefault(m => m.Name==name && m.GetParameters().Length==argc); }
    static object InvokeRef(object o, string name, object[] args)
    {
        var m=FindMethod(o,name,args.Length); if (m==null) throw new MissingMethodException(o.GetType().FullName,name);
        return m.Invoke(o,args);
    }
    static int Ret(object x) { return Convert.ToInt32(x); }
    static string[] StrArray(object x) { return x as string[] ?? (x is Array a ? a.Cast<object>().Select(v=>Convert.ToString(v)).ToArray() : new string[0]); }
    static double[] DoubleArray(object x) { return x as double[] ?? (x is Array a ? a.Cast<object>().Select(v=>Convert.ToDouble(v)).ToArray() : new double[0]); }

    class UnitState {
        public string Mode;
        public object[] Values;
    }

    static UnitState CaptureUnits(object sap, Dictionary<string,object> audit)
    {
        try {
            var zero=sap.GetType().GetMethods().FirstOrDefault(m=>m.Name=="GetPresentUnits" && m.GetParameters().Length==0);
            if(zero!=null) {
                var v=zero.Invoke(sap,new object[0]); audit["capturedBy"]="GetPresentUnits"; audit["original"]=Convert.ToString(v);
                return new UnitState{Mode="ONE",Values=new object[]{v}};
            }
            var three=sap.GetType().GetMethods().FirstOrDefault(m=>m.Name=="GetPresentUnits_2" && m.GetParameters().Length==3);
            if(three!=null) {
                var ps=three.GetParameters(); object[] a={Activator.CreateInstance(ps[0].ParameterType.GetElementType()??ps[0].ParameterType),Activator.CreateInstance(ps[1].ParameterType.GetElementType()??ps[1].ParameterType),Activator.CreateInstance(ps[2].ParameterType.GetElementType()??ps[2].ParameterType)};
                var ret=Ret(three.Invoke(sap,a)); audit["capturedBy"]="GetPresentUnits_2"; audit["captureRet"]=ret; audit["original"]=String.Join(",",a.Select(Convert.ToString));
                if(ret==0) return new UnitState{Mode="THREE",Values=a};
            }
        } catch(Exception ex) { audit["captureError"]=ex.GetBaseException().Message; }
        return null;
    }

    static bool RestoreUnits(object sap, UnitState state, Dictionary<string,object> audit)
    {
        if(state==null) { audit["restored"]=false; audit["restoreReason"]="NO_CAPTURE"; return false; }
        try {
            if(state.Mode=="ONE") {
                var m=sap.GetType().GetMethods().FirstOrDefault(x=>x.Name=="SetPresentUnits" && x.GetParameters().Length==1);
                var ret=Ret(m.Invoke(sap,new object[]{state.Values[0]})); audit["restoreRet"]=ret; audit["restored"]=ret==0; return ret==0;
            }
            if(state.Mode=="THREE") {
                var m=sap.GetType().GetMethods().FirstOrDefault(x=>x.Name=="SetPresentUnits_2" && x.GetParameters().Length==3);
                var ret=Ret(m.Invoke(sap,state.Values)); audit["restoreRet"]=ret; audit["restored"]=ret==0; return ret==0;
            }
        } catch(Exception ex) { audit["restoreError"]=ex.GetBaseException().Message; }
        audit["restored"]=false; return false;
    }

    static bool SetCanonicalUnits(object sap, Dictionary<string,object> audit)
    {
        try {
            var one=sap.GetType().GetMethods().FirstOrDefault(m=>m.Name=="SetPresentUnits" && m.GetParameters().Length==1);
            if (one!=null) {
                var et=one.GetParameters()[0].ParameterType;
                var value=Enum.Parse(et,"kN_m_C",true);
                var ret=Ret(one.Invoke(sap,new object[]{value}));
                audit["method"]="SetPresentUnits(kN_m_C)"; audit["ret"]=ret; return ret==0;
            }
            var three=sap.GetType().GetMethods().FirstOrDefault(m=>m.Name=="SetPresentUnits_2" && m.GetParameters().Length==3);
            if (three!=null) {
                var ps=three.GetParameters();
                object force=Enum.Parse(ps[0].ParameterType,"kN",true);
                object length=Enum.Parse(ps[1].ParameterType,"m",true);
                object temp=Enum.Parse(ps[2].ParameterType,"C",true);
                var ret=Ret(three.Invoke(sap,new object[]{force,length,temp}));
                audit["method"]="SetPresentUnits_2(kN,m,C)"; audit["ret"]=ret; return ret==0;
            }
        } catch(Exception ex) { audit["error"]=ex.GetBaseException().Message; }
        return false;
    }

    static Dictionary<string,object> GetAvailableTables(object db)
    {
        object[] a={0,new string[0],new string[0],new int[0],new bool[0]};
        MethodInfo m=FindMethod(db,"GetAvailableTables",5);
        if (m==null) { a=new object[]{0,new string[0],new string[0],new int[0]}; m=FindMethod(db,"GetAvailableTables",4); }
        if (m==null) throw new MissingMethodException("DatabaseTables.GetAvailableTables");
        int ret=Ret(m.Invoke(db,a));
        string[] keys=StrArray(a[1]), names=StrArray(a[2]);
        var rows=new List<Dictionary<string,object>>();
        for(int i=0;i<Math.Min(keys.Length,names.Length);i++) rows.Add(new Dictionary<string,object>{{"tableKey",keys[i]},{"tableName",names[i]}});
        return new Dictionary<string,object>{{"ret",ret},{"rows",rows}};
    }

    static string Norm(string s) { return new string((s??"").ToUpperInvariant().Where(char.IsLetterOrDigit).ToArray()); }
    static string ResolveTable(List<Dictionary<string,object>> available, params string[] candidates)
    {
        var c=new HashSet<string>(candidates.Select(Norm));
        foreach(var r in available) if(c.Contains(Norm(Convert.ToString(r["tableKey"]))) || c.Contains(Norm(Convert.ToString(r["tableName"])))) return Convert.ToString(r["tableKey"]);
        return null;
    }

    static Dictionary<string,object> ReadDisplayTable(object db, string role, string tableKey)
    {
        object[] a={tableKey,new string[]{""},"",0,new string[0],0,new string[0]};
        var m=FindMethod(db,"GetTableForDisplayArray",7); if(m==null) throw new MissingMethodException("DatabaseTables.GetTableForDisplayArray");
        int ret=Ret(m.Invoke(db,a));
        return new Dictionary<string,object>{{"role",role},{"tableKey",tableKey},{"tableVersion",Convert.ToInt32(a[3])},{"fields",StrArray(a[4])},{"numberRecords",Convert.ToInt32(a[5])},{"flatData",StrArray(a[6])},{"ret",ret}};
    }

    static List<Dictionary<string,object>> ReadCoordinates(object sap)
    {
        object pointObj=GetProp(sap,"PointObj"); object[] n={0,new string[0]};
        var gm=FindMethod(pointObj,"GetNameList",2); if(gm==null) throw new MissingMethodException("PointObj.GetNameList");
        int ret=Ret(gm.Invoke(pointObj,n)); if(ret!=0) throw new Exception("PointObj.GetNameList ret="+ret);
        var names=StrArray(n[1]); var outRows=new List<Dictionary<string,object>>();
        foreach(var name in names) {
            object[] a={name,0.0,0.0,0.0,"Global"}; var m=FindMethod(pointObj,"GetCoordCartesian",5);
            int r=Ret(m.Invoke(pointObj,a)); if(r!=0) continue;
            outRows.Add(new Dictionary<string,object>{{"Point",name},{"GlobalX",Convert.ToDouble(a[1])},{"GlobalY",Convert.ToDouble(a[2])},{"GlobalZ",Convert.ToDouble(a[3])},{"ret",r}});
        }
        return outRows;
    }

    static void SelectOutputCombos(object sap, string[] combos)
    {
        if(combos==null || combos.Length==0) return;
        object results=GetProp(sap,"Results"); object setup=GetProp(results,"Setup");
        try { Call(setup,"DeselectAllCasesAndCombosForOutput"); } catch {}
        foreach(var c in combos) {
            bool selected=false;
            foreach(var methodName in new[]{"SetComboSelectedForOutput","SetCaseSelectedForOutput"}) {
                if(selected) break;
                try {
                    var ms=setup.GetType().GetMethods().Where(m=>m.Name==methodName).OrderBy(m=>m.GetParameters().Length).ToArray();
                    foreach(var m in ms) {
                        object[] a=m.GetParameters().Length==1 ? new object[]{c} : m.GetParameters().Length==2 ? new object[]{c,true} : null;
                        if(a==null) continue;
                        if(Ret(m.Invoke(setup,a))==0) { selected=true; break; }
                    }
                } catch {}
            }
        }
    }

    static List<Dictionary<string,object>> ReadJointReactions(object sap, string[] pointNames)
    {
        object results=GetProp(sap,"Results"); var m=FindMethod(results,"JointReact",14);
        if(m==null) throw new MissingMethodException("Results.JointReact");
        var rows=new List<Dictionary<string,object>>();
        foreach(var point in pointNames) {
            object itemType=Enum.ToObject(m.GetParameters()[1].ParameterType,0); // eItemTypeElm.ObjectElm = 0
            object[] a={point,itemType,0,new string[0],new string[0],new string[0],new string[0],new double[0],new double[0],new double[0],new double[0],new double[0],new double[0],new double[0]};
            int ret=Ret(m.Invoke(results,a)); if(ret!=0) continue;
            int count=Convert.ToInt32(a[2]); var obj=StrArray(a[3]); var elm=StrArray(a[4]); var lc=StrArray(a[5]); var st=StrArray(a[6]);
            var sn=DoubleArray(a[7]); var f1=DoubleArray(a[8]); var f2=DoubleArray(a[9]); var f3=DoubleArray(a[10]); var m1=DoubleArray(a[11]); var m2=DoubleArray(a[12]); var m3=DoubleArray(a[13]);
            for(int i=0;i<count;i++) rows.Add(new Dictionary<string,object>{{"Point",point},{"Obj",i<obj.Length?obj[i]:point},{"Elm",i<elm.Length?elm[i]:""},{"LoadCase",i<lc.Length?lc[i]:""},{"StepType",i<st.Length?st[i]:""},{"StepNum",i<sn.Length?sn[i]:0.0},{"F1",f1[i]},{"F2",f2[i]},{"F3",f3[i]},{"M1",m1[i]},{"M2",m2[i]},{"M3",m3[i]},{"ret",ret}});
        }
        return rows;
    }

    static object GetLiveObject(Assembly asm, string product, out string progId)
    {
        string[] ids = product=="sap2000" ? new[]{"CSI.SAP2000.API.SapObject"} : product=="etabs" ? new[]{"CSI.ETABS.API.ETABSObject"} : new[]{"CSI.ETABS.API.ETABSObject","CSI.SAP2000.API.SapObject"};
        Type ht=asm.GetTypes().FirstOrDefault(t=>t.Name=="Helper"); if(ht==null) throw new Exception("CSiAPIv1.Helper not found");
        object helper=Activator.CreateInstance(ht); MethodInfo get=FindMethod(helper,"GetObject",1); if(get==null) throw new MissingMethodException("Helper.GetObject");
        foreach(var id in ids) { try { var o=get.Invoke(helper,new object[]{id}); if(o!=null) {progId=id; return o;} } catch {} }
        progId=null; throw new Exception("No running ETABS/SAP2000 instance found");
    }

    static string Arg(string[] a,string name,string def=null) { for(int i=0;i<a.Length-1;i++) if(a[i].Equals(name,StringComparison.OrdinalIgnoreCase)) return a[i+1]; return def; }
    static string[] CsvArg(string[] a,string name) { var x=Arg(a,name,""); return x.Split(new[]{','},StringSplitOptions.RemoveEmptyEntries).Select(s=>s.Trim()).Where(s=>s.Length>0).ToArray(); }

    static int Main(string[] args)
    {
        var result=new Dictionary<string,object>();
        object sapForRestore=null; UnitState originalUnits=null; var restoreAudit=new Dictionary<string,object>();
        try {
            string dll=Arg(args,"--csi-dll"); if(String.IsNullOrWhiteSpace(dll) || !File.Exists(dll)) throw new FileNotFoundException("CSiAPIv1.dll not found",dll);
            string product=Arg(args,"--product","auto").ToLowerInvariant(); string[] combos=CsvArg(args,"--combos");
            Assembly asm=Assembly.LoadFrom(Path.GetFullPath(dll)); string progId; object api=GetLiveObject(asm,product,out progId); object sap=GetProp(api,"SapModel"); sapForRestore=sap;
            var unitsAudit=new Dictionary<string,object>(); originalUnits=CaptureUnits(sap,unitsAudit); if(originalUnits==null) throw new Exception("Unable to capture original CSi present units");
            if(!SetCanonicalUnits(sap,unitsAudit)) throw new Exception("Unable to verify canonical kN_m_C units: "+new JavaScriptSerializer().Serialize(unitsAudit));
            SelectOutputCombos(sap,combos);
            object db=GetProp(sap,"DatabaseTables"); var availableResult=GetAvailableTables(db); var available=(List<Dictionary<string,object>>)availableResult["rows"];
            var aliases=new Dictionary<string,string[]>{
                {"pointCoordinates",new[]{"Point Coordinates","Joint Coordinates","Joint Coordinates - General"}},
                {"nodalReactions",new[]{"Nodal Reactions","Joint Reactions","Joint Reactions - General"}},
                {"pointSpringAssignments",new[]{"Point Spring Assignments","Joint Spring Assignments","Joint Assignments - Springs","Joint Assignments - Point Springs"}},
                {"pierForces",new[]{"PIERFORCES","Pier Forces","Pier Forces - General","Pier Forces - Analysis"}},
                {"pierSection",new[]{"PIERSECTION","Pier Section","Pier Section Properties","Pier Assignments - Section Properties"}}
            };
            var tables=new List<Dictionary<string,object>>();
            foreach(var kv in aliases) { var key=ResolveTable(available,kv.Value); if(key!=null) tables.Add(ReadDisplayTable(db,kv.Key,key)); }
            var coords=ReadCoordinates(sap); var pointNames=coords.Select(r=>Convert.ToString(r["Point"])).ToArray(); var reactions=ReadJointReactions(sap,pointNames);
            string modelFile=null; try { modelFile=Convert.ToString(Call(GetProp(sap,"File"),"GetModelFilename")); } catch {}
            result["ok"]=true; result["sourceMode"]="LIVE_API"; result["product"]=progId.Contains("ETABS")?"ETABS":"SAP2000"; result["apiVersion"]=asm.GetName().Version.ToString(); result["modelFile"]=modelFile;
            result["units"]=new Dictionary<string,object>{{"normalizedTo","kN_m_C"},{"verified",true},{"audit",unitsAudit}};
            result["availableTables"]=available; result["tables"]=tables; result["direct"]=new Dictionary<string,object>{{"pointCoordinates",coords},{"jointReactions",reactions}};
        } catch(Exception ex) { result["ok"]=false; result["error"]=ex.GetBaseException().Message; result["exceptionType"]=ex.GetBaseException().GetType().FullName; }
        finally { if(sapForRestore!=null) RestoreUnits(sapForRestore,originalUnits,restoreAudit); result["unitRestore"]=restoreAudit; }
        Console.OutputEncoding=System.Text.Encoding.UTF8; Console.WriteLine(new JavaScriptSerializer(){MaxJsonLength=Int32.MaxValue}.Serialize(result));
        return result.ContainsKey("ok") && (bool)result["ok"] ? 0 : 2;
    }
}
