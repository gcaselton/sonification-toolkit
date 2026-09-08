from fastapi import APIRouter, HTTPException, Request
from pathlib import Path
from paths import TMP_DIR, STYLE_FILES_DIR, SUGGESTED_DATA_DIR, SAMPLES_DIR
from context import session_id_var
from request_models import DataRequest, ComposerRefineRequest as RefineRequest, HeaderRequest, LayerRequest
from utils import resolve_file, read_YAML_file
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
import uuid



router = APIRouter(prefix='/data-composer')

@router.post('/get-columns/')
def get_columns(request: DataRequest):
    
    filepath = str(resolve_file(request.file_ref))
    
    df = pd.read_csv(filepath, header=0)
    
    col_info = []
    
    for col in df.columns:
        col_info.append(
            {
                'name': str(col),
                'NaNs': int(df[col].isna().sum()),
                'unique': df[col].is_unique
            }
        )
        
    return {'columns': col_info, 'total_rows': len(df.index)}

@router.post('/set-header/')
def set_header(request: HeaderRequest):
    
    filepath = str(resolve_file(request.file_ref))
    df = pd.read_csv(filepath, header=0 if request.has_header else None)
    
    if not request.has_header:
        # Rename headers with generic names
        df.columns = [f"Column {i + 1}" for i in range(len(df.columns))]
    
    # get names of columns containing NaNs
    invalid_columns = df.columns[df.isna().any()].tolist()
    
    # Write to CSV with headers
    df.to_csv(filepath, index=False)
    
    return {'invalid_columns': invalid_columns}
    

def refine_data(request: RefineRequest):
    
    fill_methods = {
        "min": lambda x: x.min(),
        "max": lambda x: x.max(),
        "mean": lambda x: x.mean(),
        "median": lambda x: x.median(),
        "mode": lambda x: x.mode().iloc[0], # Mode returns a Series
    }
    
    # Load csv into dataframe
    filepath = str(resolve_file(request.file_ref))
    df = pd.read_csv(filepath, header=0)
    
    # Reduce df to only selected columns
    df = df[request.columns]
    
    # Ignore non-numeric columns
    numeric_cols = df.select_dtypes(include="number").columns
    
    # Apply selected NaN strategy
    if request.nan_strategy == "fill":
        for col in numeric_cols:
            if df[col].isna().any() and not df[col].isna().all():
                fill_value = fill_methods[request.fill_with](df[col])
                df[col] = df[col].fillna(fill_value)       
    elif request.nan_strategy == "interpolate":
        df[numeric_cols] = df[numeric_cols].interpolate().bfill().ffill()
    elif request.nan_strategy == "silence":
        pass # Allow STRAUSS to mask NaNs with silence
    
    # Slice to requested row range
    start, end = request.row_range
    df = df.iloc[start:end]
        
    return df
    

@router.post('/preview-refined/')
def preview_refined(request: RefineRequest):
    
    df = refine_data(request)
    preview = df.head(request.n_preview_rows)
        
    return {
        # Convert NaNs to Python None to allow JSON encoding in response
        "rows": preview.astype(object).where(pd.notna(preview), None).to_dict(orient="records")
    }
    
    
@router.post('/save-refined/')
def save_refined(request: RefineRequest):
    
    df = refine_data(request)

    filename = f"{uuid.uuid4()}.csv"
    session_id = session_id_var.get()
    filepath = TMP_DIR / session_id / 'uploads' / filename
    file_ref = f"session:uploads:{filename}"
    
    # Write to CSV
    df.to_csv(filepath, index=False)
    
    return {"file_ref": file_ref}

@router.post('/validate-layer/')
def validate_layer(request: LayerRequest):
    
    data_path = str(resolve_file(request.data_ref))
    style_path = str(resolve_file(request.style_ref))
    
    style = read_YAML_file(style_path)
    df = pd.read_csv(data_path)
    
    response = {
        'missing_columns': [], # Columns mentioned in style but absent from data
        'non_numeric_columns': [], # Columns mentioned in style that contain non-numeric data
        'insufficient_columns': None, # More mappings requested than there are columns in data
    }

    for i, mapping in enumerate(style["map"]):
        # Column names specified in style file
        if "input" in mapping:
            col = mapping["input"]
            if col not in df.columns and col not in response['missing_columns']:
                response['missing_columns'].append(col)

        else:
            # No column name in style means STRAUSS maps columns in order (likely a suggested style)
            
            num_columns = len(df.columns)
            
            if i >= num_columns:
                # More mappings in style than there are columns in data
                response['insufficient_columns'] = {
                    'style': len(style['map']),
                    'data': num_columns
                }
                break
                
            elif not is_numeric_dtype(df.iloc[:, i]):
                # Flag non-numeric columns.
                # We don't do this above where input is specified because non-numeric columns are
                # greyed out in the custom style menu, so can't be written into a style file.
                response['non_numeric_columns'].append(df.columns[i])

    return response